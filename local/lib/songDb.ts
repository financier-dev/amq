/*
 * The song database: one MongoDB document for each library song, with the
 * IDs of its files on AMQ and the path of its cached video. `webmPath` is null
 * when the video is not cached. Every cached video must be in a document.
 *
 * `npm run scan-library` adds the songs and their files. The cache server
 * sets `webmPath` when a download completes, and `npm run register-songs`
 * fixes what it missed.
 *
 * The fields are the ones `~/amq/update-db.ts` wrote, so the scripts that read
 * the database still work. `annSongId`, `annId` and `files` are new. Documents
 * from before them have none until `register-songs` links them.
 */

import { MongoClient, type Collection, type ObjectId } from 'mongodb'
import { envValue } from '@shared/node/env'
import type { SongInfo, SongType } from '@shared/videoCache'

export interface SongFile {
  /** 0 is the mp3. */
  resolution: number
  fileId: string
}

export interface SongDoc {
  _id?: ObjectId
  annSongId?: number
  annId?: number
  anime: string
  artist: string
  name: string
  type: SongType
  typeNumber: number | null
  difficulty: number | null
  /**
   * The cached video, or null when it is not cached. Old documents have a
   * path relative to `~/amq`.
   */
  webmPath: string | null
  altAnswers: string[]
  /** False when AMQ has no file for the song. */
  uploaded?: boolean
  /** The files AMQ has for the song, as `get song extended info` gives them. */
  files?: SongFile[]
  /** When AMQ gave `files`, in ms since the epoch. */
  filesAskedAt?: number
}

/** A library song with the files AMQ gave for it. */
export interface LibrarySongFiles extends SongInfo {
  files: SongFile[]
  filesAskedAt: number
}

/** `AMQ_SONG_DB_URL` from the environment or `.env`, else a local server. */
function songDbUrl(): string {
  return (
    envValue('AMQ_SONG_DB_URL') ||
    'mongodb://localhost:27017/?directConnection=true'
  )
}

interface MetaDoc {
  _id: string
  value: unknown
}

export interface SongDb {
  client: MongoClient
  songs: Collection<SongDoc>
  /** Values the scripts keep between runs, by name. */
  meta: Collection<MetaDoc>
}

export async function openSongDb(): Promise<SongDb> {
  const client = new MongoClient(songDbUrl(), {
    serverSelectionTimeoutMS: 5_000,
  })
  try {
    await client.connect()
  } catch (error) {
    throw new Error(
      `Cannot connect to the song database (${(error as Error).message}). ` +
        'Start MongoDB, or set AMQ_SONG_DB_URL in .env.'
    )
  }
  const songs = client.db('amq').collection<SongDoc>('songs')
  await songs.createIndex(
    { annSongId: 1 },
    { unique: true, partialFilterExpression: { annSongId: { $exists: true } } }
  )
  await songs.createIndex({ 'files.fileId': 1 })
  await songs.createIndex({ webmPath: 1 })
  await songs.createIndex({ anime: 1, name: 1, type: 1, typeNumber: 1 })
  const meta = client.db('amq').collection<MetaDoc>('meta')
  return { client, songs, meta }
}

/** The master list ID of the last completed library check. */
export async function savedMasterListId(
  meta: SongDb['meta']
): Promise<string | null> {
  const doc = await meta.findOne({ _id: 'masterListId' })
  return typeof doc?.value === 'string' ? doc.value : null
}

export async function saveMasterListId(meta: SongDb['meta'], id: string) {
  await meta.updateOne(
    { _id: 'masterListId' },
    { $set: { value: id } },
    { upsert: true }
  )
}

/**
 * The document of a song: by `annSongId`, else an old document with no
 * `annSongId` and the same anime, name, artist, type and number, which is how
 * `update-db.ts` identified a song.
 */
async function findSongDoc(
  songs: Collection<SongDoc>,
  song: SongInfo
): Promise<SongDoc | null> {
  return (
    (await songs.findOne({ annSongId: song.annSongId })) ??
    (await songs.findOne({
      annSongId: { $exists: false },
      anime: song.anime,
      artist: song.artist,
      name: song.name,
      type: song.type,
      typeNumber: song.typeNumber,
    }))
  )
}

export type SaveResult = 'added' | 'updated' | 'unchanged'

/**
 * Adds or updates the document of `song`. Fields that `song` does not have,
 * such as `difficulty` from a library song, keep their value.
 */
export async function saveSong(
  songs: Collection<SongDoc>,
  song: SongInfo &
    Partial<Pick<SongDoc, 'files' | 'filesAskedAt' | 'uploaded'>>,
  webmPath?: string
): Promise<SaveResult> {
  const fields: Partial<SongDoc> = {
    annSongId: song.annSongId,
    annId: song.annId,
    anime: song.anime,
    artist: song.artist,
    name: song.name,
    type: song.type,
    typeNumber: song.typeNumber,
  }
  if (webmPath !== undefined) fields.webmPath = webmPath
  if (song.difficulty !== undefined) fields.difficulty = song.difficulty
  if (song.altAnswers !== undefined) fields.altAnswers = song.altAnswers
  if (song.uploaded !== undefined) fields.uploaded = song.uploaded
  if (song.files !== undefined) fields.files = song.files
  if (song.filesAskedAt !== undefined) fields.filesAskedAt = song.filesAskedAt

  const existing = await findSongDoc(songs, song)
  if (!existing) {
    await songs.insertOne({
      webmPath: null,
      difficulty: null,
      altAnswers: [],
      ...fields,
    } as SongDoc)
    return 'added'
  }
  // Some documents from `update-db.ts` have no `altAnswers`.
  fields.altAnswers ??= existing.altAnswers ?? []
  const result = await songs.updateOne(
    { _id: existing._id },
    { $set: fields, $unset: { owned: '' } as any }
  )
  return result.modifiedCount ? 'updated' : 'unchanged'
}

/** The songs that use a file. Several songs can use the same file. */
export async function songsWithFile(
  songs: Collection<SongDoc>,
  fileId: string
): Promise<SongDoc[]> {
  return songs.find({ 'files.fileId': fileId }).toArray()
}

/** The files of a `get song extended info` reply, by resolution. */
export function songFiles(fileNameMap: Record<string, string>): SongFile[] {
  return Object.entries(fileNameMap)
    .map(([resolution, fileId]) => ({ resolution: Number(resolution), fileId }))
    .sort((a, b) => b.resolution - a.resolution)
}

/** `files` as a song's video map: file IDs by resolution. */
export function fileMap(files: SongFile[] = []): Record<number, string> {
  return Object.fromEntries(files.map((file) => [file.resolution, file.fileId]))
}
