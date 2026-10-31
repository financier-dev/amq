// ==UserScript==
// @name         AMQ Master Script
// @namespace    amq
// @version      0.1.0
// @author       Financier
// @description  Financier's bundle of AMQ userscripts
// @license      MIT
// @match        https://animemusicquiz.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  var _GM_addStyle = /* @__PURE__ */ (() => typeof GM_addStyle != "undefined" ? GM_addStyle : void 0)();

  function addListener(event, callback) {
    const listener = new Listener(event, callback);
    listener.bindListener();
    return () => listener.unbindListener();
  }

  const defaultNames = { current: [] };
  const lowercaseNames = { current: [] };
  let tracking = false;
  function trackNames() {
    if (tracking) return;
    tracking = true;
    addListener("get all song names", (data) => {
      defaultNames.current = data.names;
      lowercaseNames.current = data.names.map(
        (name) => name.toLocaleLowerCase()
      );
    });
    addListener("update all song names", (data) => {
      if (data.deleted.length) {
        const lowercaseDeletedNames = data.deleted.map(
          (name) => name.toLocaleLowerCase()
        );
        defaultNames.current = defaultNames.current.filter(
          (name) => !data.deleted.includes(name)
        );
        lowercaseNames.current = lowercaseNames.current.filter(
          (name) => !lowercaseDeletedNames.includes(name)
        );
      }
      if (data.new.length) {
        defaultNames.current = defaultNames.current.concat(data.new);
        lowercaseNames.current = lowercaseNames.current.concat(
          data.new.map((name) => name.toLocaleLowerCase())
        );
      }
    });
  }
  const getAllAnimeNames = (options = { lowercase: false }) => {
    trackNames();
    return options.lowercase ? lowercaseNames : defaultNames;
  };
  const getFixedAnimeNames = async (...args) => {
    const animeNames = getAllAnimeNames(...args);
    while (true) {
      if (animeNames.current.length > 0) {
        return animeNames.current;
      }
      await new Promise((res) => setTimeout(res, 100));
    }
  };
  let animeList = null;
  function loadAllAnime() {
    animeList ??= new Promise((resolve) => {
      const unbind = addListener("get current master list id", async (data) => {
        unbind();
        const res = await fetch(
          `https://animemusicquiz.com/libraryMasterList?masterId=${data.masterListId}`,
          {
            headers: {
              accept: "application/json, text/javascript, */*; q=0.01",
              "x-requested-with": "XMLHttpRequest"
            },
            credentials: "include"
          }
        );
        const animeData = await res.json();
        resolve(Object.values(animeData.animeMap));
      });
      socket.sendCommand({
        type: "library",
        command: "get current master list id"
      });
    });
    return animeList;
  }

  const getAnswerInputEl = () => document.getElementById("qpAnswerInput");
  const DROPDOWN_HIDDEN_CLASS = "amq-custom-commands-dd-hidden";
  const isDropdownDisabled = () => document.getElementById("qpAnswerInputContainer")?.classList.contains(DROPDOWN_HIDDEN_CLASS) ?? false;

  const css$2 = `
.amq-answer-input-valid-answer {
  color: orange;
}
`;
  async function setup$o() {
    _GM_addStyle(css$2);
    const animeNames = new Set(await getFixedAnimeNames({ lowercase: true }));
    const answerInput = getAnswerInputEl();
    if (!answerInput) return;
    answerInput.addEventListener("input", (e) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      const value = e.target.value;
      if (animeNames.has(value.toLocaleLowerCase())) {
        answerInput.classList.add("amq-answer-input-valid-answer");
      } else {
        answerInput.classList.remove("amq-answer-input-valid-answer");
      }
    });
    answerInput.addEventListener("input", (e) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      const value = e.target.value;
      const convertedValue = translateShortcodeToUnicode(value).text;
      if (convertedValue !== value) {
        e.preventDefault();
        answerInput.value = convertedValue;
        answerInput.dispatchEvent(new Event("input", { bubbles: true }));
        answerInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  const __vite_glob_0_0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$o
  }, Symbol.toStringTag, { value: 'Module' }));

  const STACK_CLASS = "amq-avatar-stack";
  const BASE_CONTAINER_WIDTH = 160;
  const STYLE_ID = "amq-avatar-stack-styles";
  let resizeListenerRegistered = false;
  let stylesInjected = false;
  const stackCss = `
.qpAvatarBuffContainerOuter {
  pointer-events: none;
}

.qpAvatarBuffContainerOuter .qpAvatarBuff {
  pointer-events: auto;
}
`;
  function injectStyles() {
    if (stylesInjected || document.getElementById(STYLE_ID)) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = stackCss;
    document.head.appendChild(style);
  }
  function getAvatarContainerWidth() {
    const avatarContainer = document.querySelector(
      ".qpAvatarContainerOuter:not(.hide)"
    );
    return avatarContainer?.clientWidth ?? 0;
  }
  function getStackTransform() {
    const scale = getAvatarContainerWidth() / BASE_CONTAINER_WIDTH;
    return `translateY(calc(100% + 2rem)) scale(${scale})`;
  }
  function registerResizeEvent() {
    if (resizeListenerRegistered) return;
    resizeListenerRegistered = true;
    window.addEventListener("resize", () => {
      [...document.querySelectorAll("." + STACK_CLASS)].forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.transform = getStackTransform();
        }
      });
    });
  }
  function getAvatarStack(avatarContainer) {
    registerResizeEvent();
    injectStyles();
    const existingStack = avatarContainer.querySelector("." + STACK_CLASS);
    if (existingStack instanceof HTMLElement) return existingStack;
    const stack = document.createElement("div");
    stack.className = STACK_CLASS;
    stack.style.position = "absolute";
    stack.style.pointerEvents = "none";
    stack.style.display = "flex";
    stack.style.flexDirection = "column";
    stack.style.rowGap = "0.2rem";
    stack.style.transform = getStackTransform();
    stack.style.transformOrigin = "top";
    stack.style.left = "0";
    stack.style.right = "0";
    stack.style.bottom = "0";
    avatarContainer.appendChild(stack);
    return stack;
  }
  function getAvatarStackSlot(avatarContainer, className, order) {
    const stack = getAvatarStack(avatarContainer);
    const existingSlot = stack.querySelector("." + className);
    if (existingSlot instanceof HTMLElement) return existingSlot;
    const slot = document.createElement("div");
    slot.className = className;
    slot.style.display = "flex";
    slot.style.flexDirection = "column";
    slot.style.rowGap = "0.2rem";
    slot.style.order = String(order);
    stack.appendChild(slot);
    return slot;
  }

  const getPlayerName = (id) => quiz.players?.[id]?._name;
  const getPlayerAvatarContainer = (playerName) => [...document.querySelectorAll(".qpAvatarContainerOuter")].find(
    (el) => {
      const avatarName = el.querySelector(".qpAvatarName");
      return avatarName instanceof HTMLElement && avatarName.innerText === playerName;
    }
  );

  const LOCAL_STORAGE_KEY$1 = "amq-answer-times";
  const STACK_ORDER$1 = 10;
  const HINT_ICONS = {
    1: "fa-font",
    2: "fa-info-circle",
    3: "fa-bars"
  };
  const Classes = {
    CONTAINER: "player-times-container",
    PB_DIFF_TIME: "pb-diff-time",
    HINT_1_TIME: "hint-1-time",
    HINT_2_TIME: "hint-2-time",
    HINT_3_TIME: "hint-3-time",
    STANDINGS_HINT: "standings-hint",
    STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS: "correct-guesses-without-hint",
    LOCKED_ANSWER: "player-with-locked-answer",
    HIGHLIGHT_COUNT: "player-highlight-count"
  };
  const animationCss = `
@keyframes show {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

`;
  const standingsCss = `
.qpScoreBoardEntry {
  display: flex !important;
  align-items: center !important;
}

.${Classes.LOCKED_ANSWER} {
  color: goldenrod !important;
}

.${Classes.HIGHLIGHT_COUNT} {
  border-bottom: 1px solid;
}
`;
  const usersHinted = /* @__PURE__ */ new Set();
  function makeHintEl(hintId) {
    const hint = document.createElement("span");
    hint.style.display = "flex";
    hint.style.alignItems = "center";
    hint.style.justifyContent = "center";
    hint.style.backgroundColor = "rgb(9, 81, 133)";
    hint.style.borderRadius = "100%";
    hint.style.color = "white";
    hint.style.width = "1.75rem";
    hint.style.height = "1.75rem";
    hint.style.fontSize = "1rem";
    const hintIcon = document.createElement("i");
    hintIcon.className = `fa ${HINT_ICONS[hintId]}`;
    hint.appendChild(hintIcon);
    return hint;
  }
  function reportHintTime(playerName, hintTime, hintId) {
    const el = document.createElement("span");
    el.style.position = "relative";
    el.style.backgroundColor = "#1b1b1b";
    el.style.opacity = "0.8";
    el.style.color = "skyblue";
    el.style.padding = "0.4rem 1rem";
    el.style.textAlign = "center";
    const text = document.createElement("span");
    text.innerText = `${hintTime.toFixed(3)}s`;
    el.appendChild(text);
    const hint = makeHintEl(hintId);
    hint.style.position = "absolute";
    hint.style.left = "0";
    hint.style.top = "50%";
    hint.style.transform = "translate(-50%, -50%)";
    el.appendChild(hint);
    appendBoxToPlayer(playerName, el, Classes[`HINT_${hintId}_TIME`]);
  }
  function updateStandingsPlayer(playerName, hintId) {
    const scoreBoardEntryEl = getScoreBoardEntryEl(playerName);
    if (!(scoreBoardEntryEl instanceof HTMLElement)) {
      return;
    }
    const hintEl = makeHintEl(hintId);
    hintEl.style.marginLeft = "0.5rem";
    hintEl.classList.add(Classes.STANDINGS_HINT);
    scoreBoardEntryEl.appendChild(hintEl);
  }
  function updateStandings(players) {
    for (const player of players) {
      const name = getPlayerName(player.gamePlayerId);
      const scoreBoardEntryEl = getScoreBoardEntryEl(name);
      if (!(scoreBoardEntryEl instanceof HTMLElement)) {
        return;
      }
      if (!scoreBoardEntryEl.querySelector(
        "." + Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
      )) {
        const correctGuessesEl = scoreBoardEntryEl.querySelector(
          ".qpsPlayerGuessCount"
        );
        if (correctGuessesEl instanceof HTMLElement) {
          const hintlessGuessesEl = document.createElement("span");
          hintlessGuessesEl.classList.add(
            Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
          );
          hintlessGuessesEl.innerText = "0";
          hintlessGuessesEl.style.marginLeft = ".5rem";
          hintlessGuessesEl.style.color = "limegreen";
          hintlessGuessesEl.style.opacity = ".6";
          correctGuessesEl.parentNode?.insertBefore(
            hintlessGuessesEl,
            correctGuessesEl.nextSibling
          );
        }
      }
      if (player.correct) {
        const correctCountEl = scoreBoardEntryEl.querySelector(
          ".qpsPlayerGuessCount"
        );
        if (correctCountEl instanceof HTMLElement) {
          correctCountEl.classList.add(Classes.HIGHLIGHT_COUNT);
        }
        if (!usersHinted.has(name)) {
          const hintlessGuessesEl = scoreBoardEntryEl.querySelector(
            "." + Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
          );
          if (hintlessGuessesEl instanceof HTMLElement) {
            const curScore = parseInt(hintlessGuessesEl.innerText);
            hintlessGuessesEl.innerText = (curScore + 1).toString();
            hintlessGuessesEl.classList.add(Classes.HIGHLIGHT_COUNT);
          }
        }
      }
      if (player.listStatus) {
        const listCountEl = scoreBoardEntryEl.querySelector(
          ".qpScoreBoardListNumber"
        );
        if (listCountEl instanceof HTMLElement) {
          listCountEl.classList.add(Classes.HIGHLIGHT_COUNT);
        }
      }
    }
  }
  function highlightLockedPlayer(playerName) {
    const nameEl = [...document.querySelectorAll(".qpsPlayerName")].find(
      (el) => el instanceof HTMLElement && el.innerText === playerName
    );
    if (!nameEl || nameEl.classList.contains(Classes.LOCKED_ANSWER)) return;
    nameEl.classList.add(Classes.LOCKED_ANSWER);
  }
  function appendBoxToPlayer(playerName, element, className) {
    const avatarContainer = getPlayerAvatarContainer(playerName);
    if (!avatarContainer) return;
    const container = getAvatarStackSlot(
      avatarContainer,
      Classes.CONTAINER,
      STACK_ORDER$1
    );
    const existingEl = container.querySelector("." + className);
    if (existingEl) {
      existingEl.remove();
    }
    const box = document.createElement("div");
    box.className = className;
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.justifyContent = "center";
    box.style.animationName = "show";
    box.style.animationTimingFunction = "ease-out";
    box.style.animationDuration = "0.5s";
    box.style.animationFillMode = "forwards";
    box.appendChild(element);
    container.appendChild(box);
  }
  function reportPBDiff(delta) {
    const el = document.createElement("span");
    el.innerText = delta === null ? "New" : `${delta >= 0 ? "+" : ""}${delta.toFixed(3)}s`;
    el.style.backgroundColor = "#1b1b1b";
    el.style.opacity = "0.8";
    el.style.color = delta === null || delta < 0 ? "gold" : "indianred";
    el.style.padding = "0.4rem 1rem";
    el.style.textAlign = "center";
    appendBoxToPlayer(selfName, el, Classes.PB_DIFF_TIME);
  }
  const getTime = (timer) => ((/* @__PURE__ */ new Date()).getTime() - timer) / 1e3;
  const getScoreBoardEntryEl = (playerName) => [...document.querySelectorAll(".qpsPlayerName")].find((el) => el instanceof HTMLElement && el.innerText === playerName)?.closest(".qpScoreBoardEntry");
  function loadLocalStorage$1() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY$1);
      const data = JSON.parse(raw ?? "{}");
      return data;
    } catch {
      return null;
    }
  }
  function updateLocalStorage$1(data) {
    localStorage.setItem(LOCAL_STORAGE_KEY$1, JSON.stringify(data));
  }
  const isTypedAnswer = (answer, dropdownDisabled) => answer !== null && (dropdownDisabled || answer === answer.toLocaleLowerCase() || answer === answer.toLocaleUpperCase());
  async function setup$n() {
    let answerTimes = null;
    let userAnswer = null;
    let revealedAnswer = null;
    let userAnswerTime = null;
    let dropdownDisabled = false;
    {
      answerTimes = loadLocalStorage$1();
      if (answerTimes === null) {
        console.error("Error while loading answer times from local storage");
      }
    }
    _GM_addStyle(animationCss);
    _GM_addStyle(standingsCss);
    let timer = null;
    const debounceTimeoutIds = {};
    addListener("play next song", () => {
      timer = (/* @__PURE__ */ new Date()).getTime();
      [
        ...document.querySelectorAll("." + Classes.CONTAINER),
        ...document.querySelectorAll("." + Classes.STANDINGS_HINT)
      ].forEach((el) => el.remove());
      usersHinted.clear();
      [...document.querySelectorAll(".qpsPlayerName")].forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.remove(Classes.LOCKED_ANSWER);
      });
      [...document.querySelectorAll("." + Classes.HIGHLIGHT_COUNT)].forEach(
        (el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.remove(Classes.HIGHLIGHT_COUNT);
        }
      );
      userAnswer = null;
      revealedAnswer = null;
      userAnswerTime = null;
      dropdownDisabled = false;
    });
    addListener("player answered", (data) => {
      data.forEach(({ gamePlayerIds, answerTime }) => {
        gamePlayerIds.forEach((idx) => {
          const playerName = getPlayerName(idx);
          if (playerName === selfName) {
            userAnswerTime = answerTime;
            dropdownDisabled = isDropdownDisabled();
          }
          highlightLockedPlayer(playerName);
        });
      });
    });
    addListener("quiz player hint used", ({ gamePlayerIds, hintId }) => {
      if (!timer) return;
      const hintTime = getTime(timer);
      gamePlayerIds.forEach((idx) => {
        const playerName = getPlayerName(idx);
        usersHinted.add(playerName);
        updateStandingsPlayer(playerName, hintId);
        const debounceKey = `hint-${hintId}::${playerName}`;
        if (debounceTimeoutIds[debounceKey]) {
          clearTimeout(debounceTimeoutIds[debounceKey]);
        }
        debounceTimeoutIds[debounceKey] = setTimeout(
          () => reportHintTime(playerName, hintTime, hintId),
          200
        );
      });
    });
    addListener("player answers", (data) => {
      data.answers.forEach((answer) => {
        if (getPlayerName(answer.gamePlayerId) === selfName) {
          revealedAnswer = answer.answer;
          if (!quiz.teamMode) {
            userAnswer = answer.answer;
          }
        }
      });
    });
    addListener("team member answer", (data) => {
      if (getPlayerName(data.gamePlayerId) === selfName) {
        userAnswer = data.answer;
      }
    });
    addListener("answer results", (data) => {
      updateStandings(data.players);
      {
        const player = data.players.find(
          (p) => getPlayerName(p.gamePlayerId) === selfName
        );
        if (player && player.correct && isTypedAnswer(userAnswer, dropdownDisabled) && revealedAnswer !== null && userAnswer.trim().toLocaleLowerCase() === revealedAnswer.trim().toLocaleLowerCase() && answerTimes && userAnswerTime !== null) {
          const canonicalAnswer = userAnswer.trim().toLocaleLowerCase();
          const curPB = answerTimes[canonicalAnswer];
          if (!curPB || userAnswerTime < curPB) {
            reportPBDiff(curPB ? userAnswerTime - curPB : null);
            answerTimes[canonicalAnswer] = userAnswerTime;
            updateLocalStorage$1(answerTimes);
          } else {
            reportPBDiff(userAnswerTime - curPB);
          }
        }
      }
    });
  }

  const __vite_glob_0_1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$n
  }, Symbol.toStringTag, { value: 'Module' }));

  function beforeLoad() {
    AfkKicker.prototype.setupAfkTimeout = function() {
      clearTimeout(this.afkWarningTimeout);
    };
    AfkKicker.prototype.setupHostTimeout = function() {
      this.clearHostTimeout();
    };
  }
  async function setup$m() {
  }

  const __vite_glob_0_2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    beforeLoad,
    default: setup$m
  }, Symbol.toStringTag, { value: 'Module' }));

  const SHOWS_TO_HIDE = [
    "Senki Zesshou Symphogear AXZ",
    "Senki Zesshou Symphogear XV",
    "Little Busters! EX"
  ];
  async function setup$l() {
    const shouldHideVideo = (songInfo) => SHOWS_TO_HIDE.some(
      (title) => [...songInfo.altAnimeNames, ...songInfo.altAnimeNamesAnswers].some(
        (x) => title.toLocaleLowerCase() === x.toLocaleLowerCase()
      )
    );
    const getPlayers = () => {
      const player0 = document.getElementById("qpMoePlayer-0");
      const player1 = document.getElementById("qpMoePlayer-1");
      if (!player0 || !player1) throw new Error("Could not find video players");
      return [player0, player1];
    };
    addListener("answer results", (data) => {
      if (shouldHideVideo(data.songInfo)) {
        getPlayers().forEach((player) => player.style.opacity = "0");
      }
    });
    addListener("play next song", () => {
      getPlayers().forEach((player) => player.style.removeProperty("opacity"));
    });
  }

  const __vite_glob_0_3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$l
  }, Symbol.toStringTag, { value: 'Module' }));

  const commands = {};
  function registerCommand(command, getHelpObject, callback) {
    commands[command] = { callback, getHelpObject };
  }
  registerCommand(
    "help",
    () => ({
      shortHelp: "Displays this help message",
      longHelp: "Usage: /help [command]</br>Without arguments, displays a summary of all commands. With a command name, displays detailed help for that command."
    }),
    (args) => {
      const cmd = args.trim();
      if (cmd) {
        if (cmd in commands) {
          gameChat.systemMessage(commands[cmd].getHelpObject().longHelp);
        } else {
          gameChat.systemMessage(`Unknown command: ${cmd}`);
        }
      } else {
        const summary = Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)).map(
          ([cmdName, cmdObj]) => `/${cmdName}: ${cmdObj.getHelpObject().shortHelp}`
        ).join("</br>");
        gameChat.systemMessage(
          `Available commands:</br>${summary}</br>Type /help [command] for detailed help on a command.`
        );
      }
    }
  );
  async function setup$k() {
    const sendMessageFn = gameChat.sendMessage;
    gameChat.sendMessage = function() {
      const inputEl = document.getElementById("gcInput");
      const msg = inputEl?.value;
      const [head, ...rest] = msg?.split(" ") ?? [];
      const cmd = head?.slice(1);
      if (inputEl && head?.startsWith("/")) {
        if (!(cmd in commands)) {
          gameChat.systemMessage(`Unknown command: ${cmd}`);
          inputEl.value = "";
          return;
        }
        try {
          commands[cmd].callback(rest.join(" "));
        } catch (error) {
          console.error(`[amq] /${cmd} failed`, error);
          gameChat.systemMessage(
            `/${cmd} failed: ${error instanceof Error ? error.message : error}`
          );
        }
        inputEl.value = "";
      } else {
        sendMessageFn.apply(this);
      }
    };
  }

  const __vite_glob_0_9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$k,
    registerCommand
  }, Symbol.toStringTag, { value: 'Module' }));

  const DEFAULT_DELAY_S = 1;
  const parseDelay = (args) => {
    const trimmed = args.trim();
    if (trimmed === "") return DEFAULT_DELAY_S;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  async function setup$j() {
    const animeNames = getAllAnimeNames({ lowercase: true });
    const isValidAnime = (s) => animeNames.current.includes(s.toLocaleLowerCase());
    const voteSkip = () => {
      if (quiz.skipController._toggled) return;
      quiz.skipController.highlight = true;
      quiz.skipClicked();
    };
    const createAutoSkip = (command, label, description, defaultActive) => {
      let active = defaultActive;
      let delayS = DEFAULT_DELAY_S;
      const pendingTimeouts = /* @__PURE__ */ new Map();
      const cancel = (username) => {
        clearTimeout(pendingTimeouts.get(username));
        pendingTimeouts.delete(username);
      };
      const cancelAll = () => {
        pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
        pendingTimeouts.clear();
      };
      const schedule = (username, shouldVote) => {
        cancel(username);
        pendingTimeouts.set(
          username,
          setTimeout(() => {
            pendingTimeouts.delete(username);
            if (active && shouldVote()) voteSkip();
          }, delayS * 1e3)
        );
      };
      const status = () => active ? `enabled (${delayS}s delay)` : "disabled";
      const usage = `/${command} [delay in seconds, defaults to ${DEFAULT_DELAY_S}]`;
      registerCommand(
        command,
        () => ({
          shortHelp: `Toggle ${label.toLowerCase()}`,
          longHelp: `Usage: ${usage}</br>${description} With a delay argument, enables it with that delay; without one, toggles it.</br>Current value: ${status()}`
        }),
        (args) => {
          const delay = parseDelay(args);
          if (delay === null) {
            gameChat.systemMessage(`Usage: ${usage}`);
            return;
          }
          active = args.trim() !== "" || !active;
          delayS = delay;
          if (!active) cancelAll();
          gameChat.systemMessage(`${label}: ${status()}`);
        }
      );
      return {
        isActive: () => active,
        schedule,
        cancel,
        cancelAll
      };
    };
    const autoSkip = createAutoSkip(
      "autoskip",
      "Auto skip",
      "Votes to skip once the answer input contains a valid anime name.",
      true
    );
    const autoVoteSkip = createAutoSkip(
      "avs",
      "Auto vote skip",
      "Votes to skip whenever another player on your team writes a valid anime name.",
      false
    );
    const answerInput = getAnswerInputEl();
    if (answerInput) {
      answerInput.addEventListener("input", () => {
        autoSkip.cancel(selfName);
        if (!autoSkip.isActive()) return;
        const value = answerInput.value;
        if (!isValidAnime(value)) return;
        autoSkip.schedule(selfName, () => answerInput.value === value);
      });
    } else {
      console.error("amq-auto-skip: answer input not found");
    }
    addListener("team member answer", (data) => {
      if (!autoVoteSkip.isActive()) return;
      const player = quiz.players?.[data.gamePlayerId];
      if (!player || player.isSelf) return;
      if (isValidAnime(data.answer)) {
        autoVoteSkip.schedule(player._name, () => true);
      } else {
        autoVoteSkip.cancel(player._name);
      }
    });
    addListener("play next song", () => {
      autoSkip.cancelAll();
      autoVoteSkip.cancelAll();
    });
  }

  const __vite_glob_0_4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$j
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$i() {
    const DEBOUNCE_THRESHOLD_MS = 50;
    let lastSubmitTime = 0;
    let curTimeout = null;
    function getAccessorDescriptor(obj, prop) {
      if (obj === null) {
        return {
          get() {
          },
          set() {
          },
          enumerable: false,
          configurable: true
        };
      }
      const desc = Object.getOwnPropertyDescriptor(obj, prop);
      if (!desc) {
        return getAccessorDescriptor(Object.getPrototypeOf(obj), prop);
      }
      if ("writable" in desc) {
        return {
          get() {
            return desc.value;
          },
          set(v) {
            if (desc.writable) desc.value = v;
            else throw new TypeError();
          },
          enumerable: desc.enumerable,
          configurable: true
        };
      }
      return desc;
    }
    function addSetLogic(obj, prop, logic) {
      const oldDescriptor = getAccessorDescriptor(obj, prop);
      Object.defineProperty(obj, prop, {
        ...oldDescriptor,
        set(newValue) {
          oldDescriptor.set?.call(this, newValue);
          logic(newValue);
        }
      });
    }
    const sendAnswer = (answer) => socket.sendCommand({
      type: "quiz",
      command: "quiz answer",
      data: { answer }
    });
    const clear = () => {
      if (curTimeout !== null) {
        clearTimeout(curTimeout);
      }
    };
    const inputEl = document.getElementById("qpAnswerInput");
    if (!inputEl) return;
    let active = true;
    addSetLogic(
      inputEl,
      "value",
      (newValue) => active && sendAnswer(newValue)
    );
    inputEl.addEventListener("input", (event) => {
      if (!active) return;
      const answer = event.target.value || " ";
      const curTime = Date.now();
      clear();
      if (curTime - lastSubmitTime > DEBOUNCE_THRESHOLD_MS) {
        lastSubmitTime = curTime;
        sendAnswer(answer);
      } else {
        curTimeout = window.setTimeout(
          () => sendAnswer(answer),
          DEBOUNCE_THRESHOLD_MS - (curTime - lastSubmitTime)
        );
      }
    });
    registerCommand(
      "as",
      () => ({
        shortHelp: "Toggle auto submit",
        longHelp: `Usage: /as</br>Toggles automatic answer submission in team games.</br>Current value: ${active ? "enabled" : "disabled"}`
      }),
      () => {
        active = !active;
        gameChat.systemMessage(`Auto submit ${active ? "enabled" : "disabled"}`);
      }
    );
  }

  const __vite_glob_0_5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$i
  }, Symbol.toStringTag, { value: 'Module' }));

  const options$1 = {
    themes: ["Music"],
    types: ["Openings", "Endings", "Inserts"]
  };
  async function setup$h() {
    const getLabel = (el) => el.innerText.split("\n")[0].toLocaleLowerCase();
    const cb = (mutationsList) => {
      mutationsList.forEach((mutation) => {
        if (mutation.type !== "attributes" || mutation.attributeName !== "class")
          return;
        if (mutation.target instanceof HTMLElement && !mutation.target.classList.contains("hide") && !mutation.target.classList.contains("votesDisbaled")) {
          document.querySelectorAll(".qpJamVoteCategoryOptionTextContainer").forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            if (options$1.themes.concat(options$1.types).some((label) => label.toLocaleLowerCase() === getLabel(el))) {
              el.click();
            }
          });
        }
      });
    };
    const target = document.getElementById("qpJamVoteContainer");
    if (!target) throw new Error("Could not find target");
    new MutationObserver(cb).observe(target, { attributes: true });
  }

  const __vite_glob_0_6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$h
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$g() {
    let quickAnswerAuto = true;
    registerCommand(
      "qa",
      () => ({
        shortHelp: "Toggle quick answer mode",
        longHelp: `Usage: /qa</br>Toggles quick answer mode. In quick answer mode, pressing Enter without Ctrl will select the top dropdown option if there is no exact match selected.</br>Current value: ${quickAnswerAuto ? "auto" : "ctrl"}`
      }),
      () => {
        quickAnswerAuto = !quickAnswerAuto;
        gameChat.systemMessage(
          "Quick answer: " + (quickAnswerAuto ? "auto" : "ctrl")
        );
      }
    );
    function setupStyles() {
      const dropdownCss = `
  .awesomplete li.exact-match mark {
    color: lime !important
  }
  
  .awesomplete li.exact-prefix mark {
    color: yellow !important
  }

  @keyframes horizontal-shaking {
    0% { transform: translateX(0) }
    25% { transform: translateX(5px) }
    50% { transform: translateX(-5px) }
    75% { transform: translateX(5px) }
    100% { transform: translateX(0) }
  }
  .amq-better-dropdown-invalid-answer {
    animation: horizontal-shaking 0.3s forwards;
  }
  `;
      function getMatchType(answer, title) {
        if (typeof answer !== "string" || typeof title !== "string") {
          return "none";
        }
        const lcAnswer = answer.toLocaleLowerCase();
        const lcTitle = title.toLocaleLowerCase();
        if (lcAnswer === lcTitle) return "exact-match";
        if (lcTitle.startsWith(lcAnswer)) return "exact-prefix";
        return "none";
      }
      const parent = document.getElementById("qpAnswerInputContainer");
      if (!parent) {
        setTimeout(setupStyles, 1e3);
        return;
      }
      _GM_addStyle(dropdownCss);
      const setupQuickAnswer = () => {
        const inputEl = document.getElementById("qpAnswerInput");
        if (!(inputEl instanceof HTMLInputElement)) return;
        inputEl.addEventListener("keydown", (event) => {
          if (event.key.toLocaleLowerCase() !== "enter") return;
          const hasSelectedTitleInDropdown = !!document.querySelector(
            `.awesomplete ul li[aria-selected='true']`
          );
          const hasExactMatchInDropdown = !!document.querySelector(
            ".awesomplete ul li.exact-match"
          );
          if (hasSelectedTitleInDropdown || hasExactMatchInDropdown) return;
          if (!quickAnswerAuto && event.ctrlKey || quickAnswerAuto && !event.ctrlKey) {
            const option = document.querySelector(
              "#qpAnswerInputContainer #awesomplete_list_undefined_item_0"
            )?.innerText;
            if (!option) {
              inputEl.classList.add("amq-better-dropdown-invalid-answer");
              setTimeout(() => {
                inputEl.classList.remove("amq-better-dropdown-invalid-answer");
              }, 300);
              event.preventDefault();
            } else {
              inputEl.value = option;
            }
          }
        });
      };
      const mutationCallback = (mutations) => {
        const answerInput = document.querySelector("#qpAnswerInput");
        if (!answerInput) return;
        for (const mutation of mutations) {
          if (mutation.type !== "childList") continue;
          for (const addedNode of mutation.addedNodes) {
            if (!(addedNode instanceof HTMLLIElement)) {
              continue;
            }
            const matchType = getMatchType(answerInput.value, addedNode.innerText);
            if (matchType !== "none") {
              addedNode.classList.add(matchType);
            }
          }
        }
      };
      new MutationObserver(mutationCallback).observe(parent, {
        subtree: true,
        childList: true
      });
      setupQuickAnswer();
    }
    async function removeDropdownDelay() {
      const shouldIncludeENNames = (anime) => {
        if (!anime.names.some((name) => name.language === "JA")) return true;
        const jpName = anime.mainNames["JA"];
        const enName = anime.mainNames["EN"];
        if (jpName && enName) {
          const jpNameLetters = jpName.replace(/[^\p{L}]+/gu, "");
          const enNameLetters = enName.replace(/[^\p{L}]+/gu, "");
          if (jpNameLetters === enNameLetters) return true;
        }
        return false;
      };
      const allJPNames = await loadAllAnime().then(
        (animeList) => animeList.map(
          (anime) => (shouldIncludeENNames(anime) ? Object.values(anime.mainNames) : [anime.mainNames["JA"]]).filter(Boolean)
        ).flat()
      );
      const jpNamesSet = new Set(allJPNames);
      AmqAwesomeplete.prototype.evaluate = function() {
        const me = this;
        const unescapedValue = this.input.value;
        const value = createAnimeSearchRegexQuery(unescapedValue);
        let inputList;
        if (this.currentQuery && new RegExp(this.currentQuery, "i").test(unescapedValue) && this.currentSubList) {
          inputList = this.currentSubList;
        } else if (unescapedValue.length > 0) {
          const letterList = this.letterLists[unescapedValue[0].toLowerCase()];
          if (letterList) {
            inputList = letterList;
          } else {
            inputList = [];
          }
          this.currentSubList = inputList;
        } else {
          inputList = this._list;
          this.currentSubList = null;
        }
        this.currentQuery = value;
        if (value.length >= this.minChars && inputList.length > 0) {
          this.searchId++;
          const currentSearchId = this.searchId;
          $("#qpAnswerInputLoadingContainer").removeClass("hide");
          this.index = -1;
          this.$ul.children("li").remove();
          const suggestions = [];
          const selectedItems = [];
          const handlePassedSuggestions = function(me2) {
            if (this.sort !== false) {
              this.suggestions = this.suggestions.sort(this.sort);
            }
            const jpNames = this.suggestions.filter(
              (suggestion) => jpNamesSet.has(suggestion.value)
            );
            const otherNames = this.suggestions.filter(
              (suggestion) => !jpNamesSet.has(suggestion.value)
            );
            this.suggestions = [...jpNames, ...otherNames];
            this.currentSubList = selectedItems;
            this.suggestions = this.suggestions.slice(0, this.maxItems);
            for (let i = this.suggestions.length - 1; i >= 0; i--) {
              const text = this.suggestions[i];
              me2.ul.insertBefore(me2.item(text, value, i), me2.ul.firstChild);
            }
            if (this.ul.children.length === 0) {
              this.status.textContent = "No results found";
              this.close({ reason: "nomatches" });
            } else {
              this.open();
              this.status.textContent = this.ul.children.length + " results found";
            }
            $("#qpAnswerInputLoadingContainer").addClass("hide");
          }.bind(this);
          const timeoutLoop = function(index, me2, handlePassedSuggestions2, currentSearchId2) {
            if (currentSearchId2 !== this.searchId) {
              return;
            }
            for (let i = index; i < inputList.length; i++) {
              const item = inputList[i];
              const suggestion = new Suggestion(me2.data(item, value));
              if (me2.filter(suggestion, value)) {
                selectedItems.push(item);
                suggestions.push(suggestion);
              }
            }
            this.suggestions = suggestions;
            handlePassedSuggestions2(me2);
          }.bind(this);
          timeoutLoop(0, me, handlePassedSuggestions, currentSearchId);
        } else {
          this.close({ reason: "nomatches" });
          this.status.textContent = "No results found";
        }
      };
    }
    setupStyles();
    await removeDropdownDelay();
  }

  const __vite_glob_0_7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$g
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$f() {
    const cb = (mutationsList) => mutationsList.forEach((mutation) => {
      if (mutation.type !== "childList") return;
      for (const node of mutation.addedNodes) {
        const timestampEl = document.createElement("span");
        const time = /* @__PURE__ */ new Date();
        const timeStr = [time.getHours(), time.getMinutes(), time.getSeconds()].map((n) => n.toString().padStart(2, "0")).join(":");
        timestampEl.innerText = `[${timeStr}]`;
        timestampEl.style.marginRight = "0.5rem";
        if (node instanceof HTMLElement) node.prepend(timestampEl);
      }
    });
    const observer = new MutationObserver(cb);
    const target = document.querySelector("#gcMessageContainer");
    if (!target) {
      throw new Error("Could not find target");
    }
    observer.observe(target, { childList: true });
  }

  const __vite_glob_0_8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$f
  }, Symbol.toStringTag, { value: 'Module' }));

  function observePageVisibility(id, callback) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Element not found: ${id}`);
    }
    new MutationObserver(
      (mutations) => mutations.forEach((mutation) => {
        if (mutation.type !== "attributes" || mutation.attributeName !== "class")
          return;
        if (mutation.target instanceof HTMLElement) {
          callback({ visible: !mutation.target.classList.contains("hidden") });
        }
      })
    ).observe(el, { attributes: true });
  }
  const createQuizPageMutationObserver = (callback) => observePageVisibility("quizPage", callback);
  const createLobbyPageMutationObserver = (callback) => observePageVisibility("lobbyPage", callback);

  function startReturnToLobbyVote() {
    socket.sendCommand({
      type: "quiz",
      command: "start return lobby vote"
    });
  }
  async function setup$e() {
    (function setupAutoThrow() {
      let autoAnswer = "";
      registerCommand(
        "at",
        () => ({
          shortHelp: "Toggle auto throw answer",
          longHelp: `Usage: /at [answer]</br>Toggles automatic answer throwing.</br>Current value: ${autoAnswer ? '"' + autoAnswer + '"' : "disabled"}`
        }),
        (args) => {
          autoAnswer = args.trim();
          if (autoAnswer === "" && !!autoAnswer) {
            gameChat.systemMessage("Auto throw disabled");
          } else {
            gameChat.systemMessage("Auto throw answer: " + (autoAnswer || " "));
          }
        }
      );
      addListener("play next song", () => {
        if (autoAnswer) {
          socket.sendCommand({
            type: "quiz",
            command: "quiz answer",
            data: { answer: autoAnswer }
          });
        }
      });
    })();
    (function setupAutoReady() {
      let active = true;
      function maybeReady() {
        setTimeout(() => {
          if (active && lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Themed" && lobby.settings.gameMode !== "Standard") {
            lobby.fireMainButtonEvent();
          }
        });
      }
      registerCommand(
        "autoready",
        () => ({
          shortHelp: "Toggle auto ready",
          longHelp: `Usage: /autoready</br>Toggles automatic readying when in the lobby.</br>Current value: ${active ? "enabled" : "disabled"}`
        }),
        () => {
          active = !active;
          if (active) maybeReady();
          gameChat.systemMessage(
            "Auto ready: " + (active ? "enabled" : "disabled")
          );
        }
      );
      createLobbyPageMutationObserver(({ visible }) => visible && maybeReady());
      addListener("Room Settings Changed", maybeReady);
      addListener("Host Promotion", maybeReady);
      addListener("Change To Player", maybeReady);
    })();
    const autoStart = (function setupAutoStart() {
      let startTimeout = null;
      const maybeStart = (options) => {
        const conditions = [
          [lobby.isHost, "You are not the host"],
          [lobby.inLobby, "You are not in the lobby"],
          [
            lobby.numberOfPlayersReady === Object.keys(lobby.players).length,
            "Not all players are ready"
          ],
          [
            lobby.settings.gameMode !== "Themed" && lobby.settings.gameMode !== "Standard",
            "Invalid game mode"
          ]
        ];
        const failedCond = conditions.find((cond) => !cond[0]);
        if (failedCond) {
          if (options.verbose) {
            gameChat.systemMessage(`Failed to auto start: ${failedCond[1]}`);
          }
          return false;
        }
        socket.sendCommand({
          type: "lobby",
          command: "start game"
        });
        return true;
      };
      const abortAutoStart = () => {
        if (!startTimeout) return false;
        clearTimeout(startTimeout);
        startTimeout = null;
        return true;
      };
      const startReady = () => {
        abortAutoStart();
        gameChat.systemMessage(`Auto starting when all players are ready`);
        startTimeout = setTimeout(function fn() {
          startTimeout = null;
          if (!maybeStart({ verbose: false })) {
            startTimeout = setTimeout(fn, 500);
          }
        }, 500);
      };
      registerCommand(
        "start",
        () => ({
          shortHelp: "Auto start the game",
          longHelp: "Usage: /start [seconds|ready|abort]</br>Automatically starts the game after a delay in seconds, when all players are ready, or aborts a pending auto start."
        }),
        (args) => {
          if (!lobby.isHost) {
            gameChat.systemMessage("You must be the host to use this command");
            return;
          }
          const delay = Number(args.split(" ").pop());
          if (Number.isFinite(delay) && delay >= 0) {
            abortAutoStart();
            gameChat.systemMessage(`Auto starting in ${delay} seconds`);
            startTimeout = setTimeout(() => {
              startTimeout = null;
              maybeStart({ verbose: true });
            }, 1e3 * delay);
            return;
          } else if (args === "abort") {
            if (!abortAutoStart()) {
              gameChat.systemMessage("Auto start is not set, nothing to abort");
            }
          } else if (args === "ready") {
            startReady();
          }
        }
      );
      return { startReady, abort: abortAutoStart };
    })();
    (function setupAutoStartOnQuizEnd() {
      let active = false;
      registerCommand(
        "autostart",
        () => ({
          shortHelp: "Toggle auto start when quiz ends",
          longHelp: `Usage: /autostart</br>Toggles automatically running "/start ready" every time the quiz ends.</br>Current value: ${active ? "enabled" : "disabled"}`
        }),
        () => {
          active = !active;
          gameChat.systemMessage(
            `Auto start on quiz end: ${active ? "enabled" : "disabled"}`
          );
        }
      );
      let quizOverSeen = false;
      addListener("quiz over", () => {
        quizOverSeen = true;
        if (active && lobby.isHost) {
          autoStart.startReady();
        }
      });
      createQuizPageMutationObserver(({ visible }) => {
        if (visible) return;
        if (!quizOverSeen) {
          autoStart.abort();
        }
        quizOverSeen = false;
      });
    })();
    (function setupAutoSpectate() {
      let specTimeout = null;
      const maybeSpec = () => {
        if (!lobby.inLobby || lobby.settings.gameMode === "Themed" || lobby.settings.gameMode === "Standard") {
          return false;
        }
        socket.sendCommand({
          type: "lobby",
          command: "change player to spectator",
          data: {
            playerName: selfName
          }
        });
        return true;
      };
      registerCommand(
        "spec",
        () => ({
          shortHelp: "Goes into spectator mode once the current game ends",
          longHelp: "Usage: /spec [abort]</br>Goes into spectator mode once the current game ends, or aborts a pending auto spectate."
        }),
        (args) => {
          if (args === "") {
            if (specTimeout) {
              gameChat.systemMessage("Auto spectate is already set");
              return;
            }
            gameChat.systemMessage("Will auto spectate after current game ends");
            specTimeout = setTimeout(function fn() {
              specTimeout = null;
              if (!maybeSpec()) {
                specTimeout = setTimeout(fn, 500);
              }
            }, 500);
          } else if (args === "abort") {
            if (!specTimeout) {
              gameChat.systemMessage("Auto spectate is not set, nothing to abort");
              return;
            }
            clearTimeout(specTimeout);
            specTimeout = null;
            gameChat.systemMessage("Auto spectate aborted");
          } else {
            gameChat.systemMessage(`Invalid argument: ${args}`);
          }
        }
      );
    })();
    (function setupHostPromotion() {
      let promoteTimeout = null;
      const abort = () => {
        if (!promoteTimeout) return false;
        clearTimeout(promoteTimeout);
        promoteTimeout = null;
        return true;
      };
      const resolveName = (typed) => Object.values(lobby.players).map((player) => player.name).find(
        (name) => name.toLocaleLowerCase() === typed.toLocaleLowerCase()
      ) ?? typed;
      const promoteWhenInLobby = (typed) => {
        promoteTimeout = setTimeout(function fn() {
          promoteTimeout = null;
          if (!lobby.inLobby) {
            promoteTimeout = setTimeout(fn, 500);
            return;
          }
          if (!lobby.isHost) {
            gameChat.systemMessage(
              `Did not promote ${typed}: you are no longer the host`
            );
            return;
          }
          lobby.promoteHost(resolveName(typed));
        }, 0);
      };
      registerCommand(
        "host",
        () => ({
          shortHelp: "Promote a player to host in the lobby",
          longHelp: "Usage: /host [username]</br>Promotes [username] to host the next time the game is in the lobby. You must be the host. Without a username, cancels a pending promotion."
        }),
        (args) => {
          const username = args.trim();
          if (username === "") {
            gameChat.systemMessage(
              abort() ? "Host promotion cancelled" : "Usage: /host [username]"
            );
            return;
          }
          if (!lobby.isHost) {
            gameChat.systemMessage("You must be the host to use this command");
            return;
          }
          abort();
          if (!lobby.inLobby) {
            gameChat.systemMessage(
              `Will promote ${username} to host when the game returns to the lobby`
            );
          }
          promoteWhenInLobby(username);
        }
      );
    })();
    (function setupDropdownHider() {
      let active = true;
      const allAnimeNames = getAllAnimeNames({ lowercase: true });
      const dropdownCss = `
      @keyframes horizontal-shaking {
        0% { transform: translateX(0) }
        25% { transform: translateX(5px) }
        50% { transform: translateX(-5px) }
        75% { transform: translateX(5px) }
        100% { transform: translateX(0) }
      }
      .amq-custom-commands-invalid-answer {
        animation: horizontal-shaking 0.3s forwards;
      }
      #qpAnswerInputContainer.${DROPDOWN_HIDDEN_CLASS} .awesomplete > ul {
        display: none !important;
      }`;
      _GM_addStyle(dropdownCss);
      const preventSkipOnInvalidAnswer = (event) => {
        if (event.key.toLocaleLowerCase() !== "enter") return;
        const inputEl = document.getElementById("qpAnswerInput");
        if (!(inputEl instanceof HTMLInputElement)) return;
        const answer = inputEl.value.trim().toLocaleLowerCase();
        if (!allAnimeNames.current.includes(answer)) {
          inputEl.classList.add("amq-custom-commands-invalid-answer");
          setTimeout(() => {
            inputEl.classList.remove("amq-custom-commands-invalid-answer");
          }, 300);
          event.preventDefault();
          event.stopPropagation();
        }
      };
      registerCommand(
        "dd",
        () => ({
          shortHelp: "Toggle dropdown",
          longHelp: `Usage: /dd</br>Toggles the answer dropdown visibility.</br>Current value: ${active ? "enabled" : "disabled"}`
        }),
        () => {
          const containerEl = document.getElementById("qpAnswerInputContainer");
          if (!(containerEl instanceof HTMLElement)) {
            gameChat.systemMessage(
              "Error: Unable to toggle dropdown: Answer input container not found"
            );
            console.error("Unable to find answer input container element");
            return;
          }
          containerEl.classList.toggle(DROPDOWN_HIDDEN_CLASS, active);
          gameChat.systemMessage(`Dropdown ${active ? "disabled" : "enabled"}`);
          active = !active;
          const inputEl = document.getElementById("qpAnswerInput");
          if (!(inputEl instanceof HTMLInputElement)) {
            console.error("custom-commands: Unable to find input element");
            return;
          }
          if (active) {
            inputEl.removeEventListener("keydown", preventSkipOnInvalidAnswer);
          } else {
            inputEl.addEventListener("keydown", preventSkipOnInvalidAnswer);
          }
        }
      );
    })();
    (function setupAutoVoteYesOnReturnToLobby() {
      let active = true;
      registerCommand(
        "autovoteyes",
        () => ({
          shortHelp: "Toggle auto vote yes",
          longHelp: `Usage: /autovoteyes</br>Toggles automatic voting yes on return to lobby.</br>Current value: ${active ? "enabled" : "disabled"}`
        }),
        () => {
          active = !active;
          gameChat.systemMessage(
            `Auto vote yes on return to lobby: ${active ? "enabled" : "disabled"}`
          );
        }
      );
      addListener("return lobby vote start", () => {
        if (!active) return;
        function voteYes(counter = 0) {
          if (counter > 100) {
            console.error("Failed to auto vote yes: Button not found");
            return;
          }
          const yesButton = document.querySelector(
            "#qpReturnLobbyVoteContainer .leftVoteButtonYes"
          );
          if (!(yesButton instanceof HTMLElement)) {
            setTimeout(() => voteYes(counter + 1), 100);
            return;
          }
          yesButton.click();
        }
        setTimeout(voteYes, 500);
      });
    })();
    (function setupAutoReturnToLobbyOnTeamDeath() {
      let active = true;
      const animeNames = getAllAnimeNames({ lowercase: true });
      registerCommand(
        "autoreturnlobby",
        () => ({
          shortHelp: "Toggle auto return to lobby on team death",
          longHelp: `Usage: /autoreturnlobby</br>Toggles automatic return to lobby vote when an invalid answers causes the team to die in a 1T game.</br>Current value: ${active ? "enabled" : "disabled"}`
        }),
        () => {
          active = !active;
          gameChat.systemMessage(
            `Auto return to lobby on team death: ${active ? "enabled" : "disabled"}`
          );
        }
      );
      const isOneTeamGame = () => {
        return lobby.isHost && lobby.settings.gameMode !== "Themed" && lobby.settings.gameMode !== "Standard" && Object.keys(quiz.scoreboard.teamMap).length === 1;
      };
      addListener("player answers", (data) => {
        if (!active || !isOneTeamGame()) return;
        const isLastLife = Object.values(quiz.players)[0].avatarSlot.lifeCounterController.currentLives === 1;
        const isValidAnswer = animeNames.current.includes(
          data.answers[0].answer.toLocaleLowerCase().trim()
        );
        if (isLastLife && !isValidAnswer) {
          startReturnToLobbyVote();
        }
      });
    })();
    (function setupReturnToLobbyVoteCommand() {
      registerCommand(
        "lobby",
        () => ({
          shortHelp: "Start return to lobby vote",
          longHelp: "Usage: /lobby</br>Starts a vote to return to the lobby."
        }),
        () => {
          gameChat.systemMessage("Starting return to lobby vote");
          startReturnToLobbyVote();
        }
      );
    })();
    (function setupPauseCommand() {
      registerCommand(
        "p",
        () => ({
          shortHelp: "Pause the quiz",
          longHelp: "Usage: /pause</br>Pauses the current quiz."
        }),
        () => {
          if (!lobby.isHost) {
            gameChat.systemMessage("You must be the host to use this command");
            return;
          }
          if (quiz.pauseButton.pauseOn) {
            gameChat.systemMessage("Resuming game");
            socket.sendCommand({
              type: "quiz",
              command: "quiz unpause"
            });
          } else {
            gameChat.systemMessage("Pausing game");
            socket.sendCommand({
              type: "quiz",
              command: "quiz pause"
            });
          }
        }
      );
    })();
  }

  const __vite_glob_0_10 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$e
  }, Symbol.toStringTag, { value: 'Module' }));

  const BACKGROUND_URL = "https://images8.alphacoders.com/695/695848.png";
  async function setup$d() {
    const backgroundCss = `
  :root {
	--bg: url("${BACKGROUND_URL}");
	/* Optional: if you want a different background for chat. Phone wallpapers tend to work best. */
	--chatbg: rgba(0,0,0,0.5);
  }

  #gameContainer {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #startPage {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #awMainView {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #loadingScreen {
	background-image: none;
	background-color: transparent;
  }

  #gameChatPage > .col-xs-9 {
	background-image: none;
	background-color: transparent;
  }

  #gameChatContainer {
	background: var(--chatbg);
  }

  .leftShadowBorder {
	box-shadow: none;
	  -webkit-box-shadow: none;
  }

  .gcList > li:nth-child(2n) {
	background: none;
  }

  .gcInputContainer {
	background: none;
  }

  #gcEmojiPickerButton > i {
	color: #d9d9d9;
  }

  #nexusCityContainer {
    height: 100vh !important;
  }

  .nexusFullCanvas {
    height: 100vh !important;
  }
`;
    const generalCss = `
  /* Invisible footer */
  #footerMenuBarBackground, #rightMenuBarPartContainer::before {
    background-color: rgba(0, 0, 0, 0)
  }

  /* Hides menus with invisible footer */
  #optionsContainer:not(.open), #socialTab:not(.open) {
    position: relative;
    top: 30px;
  }

  /* Transparent components */
  #currencyContainer,
  #menuBarOptionContainer,
  #mainMenuSocailButton {
    background-color: rgba(27, 27, 27, 0.7)
  }

  #xpBarOuter {
    opacity: 0.95
  }

  .qpAvatarImgContainer {
    box-shadow: none;
    background-color: rgba(27, 27, 27, 0)
  }

  .chatBox::before {
    opacity: 0;
  }

  .chatBox {
    width: 250px !important;
  }

  #chatContainer {
    height: 400px !important;
  }

  #activeChatScrollContainer {
    margin-top: 355px !important;
  }

  .chatBoxContainer {
    height: 300px !important;
    background-color: rgba(68, 68, 68, 0.8) !important;
  }

  .chatContent {
    height: 232px !important;
  }
`;
    const gameCss = `
  #qpStandingContainer,
  #qpAnimeNameContainer,
  #qpAnimeNameHider,
  #qpCounter,
  .qpSideContainer,
  .qpAvatarNameContainer,
  .qpAvatarNumberContainer,
  .qpAvatarInfoContainer > div,
  .qpAvatarAnswerContainer,
  #qpVideoOverflowContainer,
  .awesomplete > ul {
    background-color: rgba(27, 27, 27, 0.7);
  }

  #qpVideoHider {
    background-color: rgba(27, 27, 27, 0);
  }

  #qpAnimeNameHider {
    border-radius: 5px;
  }

  #qpAnimeNameContainer {
    font-family: monospace;
    box-shadow: none;
    border-radius: 5px;
  }

  .qpAnimeNameContainer {
    width: 60rem !important;
    max-width: 100%;
  }

  #qpInfoHider,
  #qpReportContainer,
  #qpUpvoteContainer,
  #qpDownvoteContainer {
    background-color: rgba(27, 27, 27, 0);
  }

  .qpAvatarImgContainer {
    box-shadow: none;
    background-color: rgba(27, 27, 27, 0)
  }

  #qpVideoTroubleshootingContainer {
    display: none;
  }

  // #qpAvatarRowEnemyContainer,
  // #qpAvatarRowAvatarContainer {
  //   height: 80% !important;
  // }

  .awesomplete > ul {
    max-height: 100px !important;
  }

  .nexusView #qpVideoContainerOuter {
    max-width: 75% !important;
  }

  .qpSideContainer {
    margin-top: 20% !important;
    max-width: 300px !important;
  }

  /* AMQ ships 5px here, which runs the avatars into the edges and the chat */
  #qpAvatarRow {
    padding: 0 25px !important;
  }

  /* Frees up horizontal space for the song history panel */
  #gameChatPage > .col-xs-9 {
    width: calc(100% - min(25%, 500px)) !important;
  }

  #gameChatContainer {
    width: min(25%, 500px) !important;
    max-width: 500px !important;
  }

  /*
   * The video sizes itself with padding-top: 56.25%, which resolves against the
   * parent's width, so capping the video's own width would break the aspect
   * ratio. Cap the height too and let min() keep it 16:9.
   */
  #qpVideoContainer {
    width: min(100%, 800px) !important;
    padding-top: min(56.25%, 450px) !important;
    margin: 12px auto 0 !important;
  }

  /* Mirrors AMQ's own short-window shrink, with the same 800px cap */
  @media screen and (max-height: 749px) {
    #qpVideoContainer {
      width: min(80%, 800px) !important;
      padding-top: min(45.1%, 450px) !important;
    }
  }
  
  /* Fixes lag for long answers */
  .qpAvatarAnswerText.rightAnswer {
    text-shadow: none !important;
    color: #b6ff00;
  }
  .qpAvatarAnswerText.wrongAnswer {
    text-shadow: none !important;
    color: #fb1212;
  }

  .teamValidNameGuess {
    color: orange;
  }

  /* Fixes chat on iPad */
  #gameChatPage {
    height: calc(100dvh - 45px);
  }

  .awesomplete {
    font-size: 18px !important;
  }
`;
    function extend(func, method, ext) {
      const old = (func.fn ? func.fn : func.prototype)[method];
      func.prototype[method] = function(...args) {
        const result = old.apply(this, args);
        ext.apply(this, args);
        return result;
      };
    }
    function hideVideoOnRejoin() {
      const hideVideo = () => {
        $("#qpMoePlayer-0").css("display", "none");
        $("#qpMoePlayer-1").css("display", "none");
      };
      addListener("answer results", () => {
        $("#qpMoePlayer-0").css("display", "");
        $("#qpMoePlayer-1").css("display", "");
      });
      createQuizPageMutationObserver(({ visible }) => {
        if (visible) hideVideo();
      });
    }
    _GM_addStyle(backgroundCss);
    _GM_addStyle(generalCss);
    _GM_addStyle(gameCss);
    hideVideoOnRejoin();
    (() => {
      const target = document.getElementById("qpSongInfoContainer")?.parentElement;
      if (!target) {
        throw new Error("Could not find target element");
      }
      Object.assign(target.style, {
        position: "absolute",
        right: "0"
      });
    })();
    (function highlightValidAnswers() {
      const animeNames = getAllAnimeNames({ lowercase: true });
      addListener("team member answer", (data) => {
        const playerName = getPlayerName(data.gamePlayerId);
        const playerAnswerEl = getPlayerAvatarContainer(
          playerName
        )?.querySelector(".qpAvatarAnswerText");
        if (!(playerAnswerEl instanceof HTMLElement)) {
          return;
        }
        const isValidGuess = animeNames.current.includes(
          data.answer.toLocaleLowerCase()
        );
        if (isValidGuess) {
          playerAnswerEl.classList.add("teamValidNameGuess");
        } else {
          playerAnswerEl.classList.remove("teamValidNameGuess");
        }
      });
    })();
    const nameHiderObserver = new MutationObserver((list) => {
      const mutation = list[0];
      if (!mutation) {
        return;
      }
      if (mutation.type === "attributes" && mutation.attributeName === "class") {
        if (mutation.target instanceof HTMLElement && mutation.target.classList?.contains("hide")) {
          $("#qpAnimeNameContainer").css("visibility", "visible");
        } else {
          $("#qpAnimeNameContainer").css("visibility", "hidden");
        }
      }
    });
    extend(QuizInfoContainer, "showContent", function() {
      $("#qpInfoHider").prevAll().css("visibility", "visible");
      $("#qpVideoSoundOnly").css("visibility", "visible");
    });
    extend(QuizInfoContainer, "displayInfoBoxHint", function() {
      $("#qpInfoHider").prevAll().css("visibility", "visible");
      $("#qpVideoSoundOnly").css("visibility", "visible");
    });
    extend(QuizInfoContainer, "hideContent", function() {
      $("#qpInfoHider").prevAll().css("visibility", "hidden");
      $("#qpVideoSoundOnly").css("visibility", "hidden");
    });
    const isNexusMode = () => quiz?.gameMode === "Nexus";
    createQuizPageMutationObserver(({ visible }) => {
      if (visible) {
        $("#qpSongInfoContainer").css(
          "transform",
          isNexusMode() ? "translateY(-6rem)" : ""
        );
        const animeNameHiderEl = document.getElementById("qpAnimeNameHider");
        if (!animeNameHiderEl) {
          throw new Error("animeNameHider element not found");
        }
        nameHiderObserver.observe(animeNameHiderEl, { attributes: true });
      } else {
        nameHiderObserver.disconnect();
      }
    });
  }

  const __vite_glob_0_11 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$d
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$c() {
    const CONTAINER_ID = "__amq-extra-song-info-container";
    const info = {
      type: {
        title: "Type",
        element: null
      },
      vintage: {
        title: "Vintage",
        element: null
      },
      rating: {
        title: "Anime Rating",
        element: null
      },
      difficulty: {
        title: "Difficulty",
        element: null
      },
      sample: {
        title: "Sample",
        element: null
      }
    };
    function formatSampleTime(totalSeconds) {
      const rounded = Math.round(totalSeconds);
      const minutes = Math.floor(rounded / 60);
      const seconds = rounded % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    {
      const songTypeRow = document.getElementById("qpSongType")?.parentNode;
      if (!(songTypeRow instanceof HTMLElement)) return;
      const infoHiderEl = document.getElementById("qpInfoHider");
      if (infoHiderEl instanceof HTMLElement) {
        Object.assign(infoHiderEl.style, {
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        });
      }
      const extraInfoContainer = document.createElement("div");
      extraInfoContainer.style.marginBottom = "1rem";
      songTypeRow.parentNode?.insertBefore(
        extraInfoContainer,
        songTypeRow.nextSibling
      );
      Object.values(info).forEach((row) => {
        const rowEl = songTypeRow.cloneNode(false);
        Object.assign(rowEl.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          columnGap: "0.5rem"
        });
        const titleEl = document.createElement("span");
        titleEl.style.fontWeight = "bold";
        titleEl.innerText = row.title + ":";
        const valueEl = document.createElement("span");
        row.element = valueEl;
        rowEl.append(titleEl, valueEl);
        extraInfoContainer.append(rowEl);
      });
    }
    function updateInfo(songInfo) {
      const setText = (row, text) => {
        if (row.element) row.element.innerText = text;
      };
      setText(info.type, songInfo.animeType);
      setText(
        info.vintage,
        typeof songInfo.vintage === "string" ? songInfo.vintage : localizationHandler.translate(
          songInfo.vintage.key,
          songInfo.vintage.data
        )
      );
      setText(
        info.rating,
        songInfo.animeScore === "?" ? "?" : songInfo.animeScore + "/10"
      );
      setText(
        info.difficulty,
        songInfo.animeDifficulty === "?" ? "?" : songInfo.animeDifficulty == null || typeof songInfo.animeDifficulty !== "number" ? "unrated" : songInfo.animeDifficulty.toFixed(2)
      );
      const sampleStart = quizVideoController.getCurrentVideoStartPoint();
      const sampleTotal = quizVideoController.getCurrentVideoLength();
      setText(
        info.sample,
        sampleStart == null || sampleTotal == null || !Number.isFinite(sampleTotal) ? "unknown" : `${formatSampleTime(sampleStart)} / ${formatSampleTime(sampleTotal)}`
      );
    }
    addListener("quiz song hint", ({ songInfo }) => {
      updateInfo(songInfo);
    });
    addListener("answer results", ({ songInfo }) => {
      updateInfo(songInfo);
    });
    addListener("Spectate Game", ({ quizState }) => {
      if (quizState.songInfo?.animeType) {
        updateInfo(quizState.songInfo);
      }
    });
    addListener("nexus game events", ({ events }) => {
      events.flatMap(
        (event) => event.type === "queueEvent" ? event.events : []
      ).filter((event) => event.type === "songInfoHint").forEach(({ songInfo }) => updateInfo(songInfo));
    });
    addListener("play next song", () => {
    });
    createQuizPageMutationObserver(({ visible }) => {
      if (visible) return;
      const container = document.getElementById(CONTAINER_ID);
      if (!container) return;
      container.classList.add("hide");
    });
  }

  const __vite_glob_0_12 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$c
  }, Symbol.toStringTag, { value: 'Module' }));

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  var cjs;
  var hasRequiredCjs;

  function requireCjs () {
  	if (hasRequiredCjs) return cjs;
  	hasRequiredCjs = 1;

  	var isMergeableObject = function isMergeableObject(value) {
  		return isNonNullObject(value)
  			&& !isSpecial(value)
  	};

  	function isNonNullObject(value) {
  		return !!value && typeof value === 'object'
  	}

  	function isSpecial(value) {
  		var stringValue = Object.prototype.toString.call(value);

  		return stringValue === '[object RegExp]'
  			|| stringValue === '[object Date]'
  			|| isReactElement(value)
  	}

  	// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
  	var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
  	var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

  	function isReactElement(value) {
  		return value.$$typeof === REACT_ELEMENT_TYPE
  	}

  	function emptyTarget(val) {
  		return Array.isArray(val) ? [] : {}
  	}

  	function cloneUnlessOtherwiseSpecified(value, options) {
  		return (options.clone !== false && options.isMergeableObject(value))
  			? deepmerge(emptyTarget(value), value, options)
  			: value
  	}

  	function defaultArrayMerge(target, source, options) {
  		return target.concat(source).map(function(element) {
  			return cloneUnlessOtherwiseSpecified(element, options)
  		})
  	}

  	function getMergeFunction(key, options) {
  		if (!options.customMerge) {
  			return deepmerge
  		}
  		var customMerge = options.customMerge(key);
  		return typeof customMerge === 'function' ? customMerge : deepmerge
  	}

  	function getEnumerableOwnPropertySymbols(target) {
  		return Object.getOwnPropertySymbols
  			? Object.getOwnPropertySymbols(target).filter(function(symbol) {
  				return Object.propertyIsEnumerable.call(target, symbol)
  			})
  			: []
  	}

  	function getKeys(target) {
  		return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
  	}

  	function propertyIsOnObject(object, property) {
  		try {
  			return property in object
  		} catch(_) {
  			return false
  		}
  	}

  	// Protects from prototype poisoning and unexpected merging up the prototype chain.
  	function propertyIsUnsafe(target, key) {
  		return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
  			&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
  				&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
  	}

  	function mergeObject(target, source, options) {
  		var destination = {};
  		if (options.isMergeableObject(target)) {
  			getKeys(target).forEach(function(key) {
  				destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
  			});
  		}
  		getKeys(source).forEach(function(key) {
  			if (propertyIsUnsafe(target, key)) {
  				return
  			}

  			if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
  				destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
  			} else {
  				destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
  			}
  		});
  		return destination
  	}

  	function deepmerge(target, source, options) {
  		options = options || {};
  		options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  		options.isMergeableObject = options.isMergeableObject || isMergeableObject;
  		// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
  		// implementations can use it. The caller may not replace it.
  		options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

  		var sourceIsArray = Array.isArray(source);
  		var targetIsArray = Array.isArray(target);
  		var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

  		if (!sourceAndTargetTypesMatch) {
  			return cloneUnlessOtherwiseSpecified(source, options)
  		} else if (sourceIsArray) {
  			return options.arrayMerge(target, source, options)
  		} else {
  			return mergeObject(target, source, options)
  		}
  	}

  	deepmerge.all = function deepmergeAll(array, options) {
  		if (!Array.isArray(array)) {
  			throw new Error('first argument should be an array')
  		}

  		return array.reduce(function(prev, next) {
  			return deepmerge(prev, next, options)
  		}, {})
  	};

  	var deepmerge_1 = deepmerge;

  	cjs = deepmerge_1;
  	return cjs;
  }

  var cjsExports = requireCjs();
  const merge = /*@__PURE__*/getDefaultExportFromCjs(cjsExports);

  let batchedChanges = {};
  function changeSettings(settingChanges) {
    batchedChanges = merge(batchedChanges, settingChanges);
    if (!lobby.inLobby) {
      gameChat.systemMessage("Settings changes will be applied when in lobby");
    }
    const doit = () => {
      if (!lobby.inLobby) {
        setTimeout(doit, 100);
        return;
      }
      socket.sendCommand({
        type: "lobby",
        command: "change game settings",
        data: {
          settingChanges: batchedChanges,
          communityMode: false
        }
      });
      batchedChanges = {};
    };
    doit();
  }
  function changeDiff(min, max) {
    changeSettings({
      songDifficulity: {
        ...lobby.settings.songDifficulity,
        advancedOn: true,
        advancedValue: [min, max]
      }
    });
  }
  function changeType(types) {
    const openings = types.includes("op");
    const endings = types.includes("ed");
    const inserts = types.includes("in");
    if (!openings && !endings && !inserts) {
      return;
    }
    changeSettings({
      songType: {
        ...lobby.settings.songType,
        standardValue: { openings, endings, inserts }
      }
    });
  }
  function changeSongs(numSongs) {
    changeSettings({
      numberOfSongs: numSongs,
      songSelection: {
        ...lobby.settings.songSelection,
        advancedValue: { watched: numSongs, unwatched: 0, random: 0 }
      },
      songType: {
        ...lobby.settings.songType,
        advancedValue: { openings: 0, endings: 0, inserts: 0, random: numSongs }
      }
    });
  }
  function getGenreObj(genre) {
    return hostModal.genreFilter.awesomepleteInstance._list.find(
      (g) => g.name.toLocaleLowerCase() === genre.toLocaleLowerCase()
    );
  }
  function addGenre(genre) {
    changeSettings({
      genre: [...lobby.settings.genre, { id: genre.id.toString(), state: 1 }]
    });
  }
  function removeGenre(genre) {
    changeSettings({
      genre: [
        ...lobby.settings.genre.filter((g) => String(g.id) !== String(genre.id))
      ]
    });
  }
  function removeAllGenres() {
    changeSettings({ genre: [] });
  }
  function changeTeamSize(size) {
    changeSettings({ teamSize: size });
  }
  function changeRoomSize(size) {
    changeSettings({ roomSize: size });
  }
  function changeGuessTime(time, extraTime = 0) {
    changeSettings({
      guessTime: {
        randomOn: false,
        randomValue: [1, 60],
        standardValue: time
      },
      extraGuessTime: {
        randomOn: false,
        randomValue: [0, 15],
        standardValue: extraTime
      }
    });
  }
  function changeWatchedDistribution(dist) {
    changeSettings({ watchedDistribution: dist });
  }
  function changeRoomTitle(title) {
    changeSettings({ roomName: title });
  }
  function toggleChantings(enable) {
    changeSettings({
      openingCategories: {
        ...lobby.settings.openingCategories,
        chanting: enable
      },
      endingCategories: {
        ...lobby.settings.endingCategories,
        chanting: enable
      },
      insertCategories: {
        ...lobby.settings.insertCategories,
        chanting: enable
      }
    });
  }
  function setFullSongRange(enable) {
    changeSettings({
      modifiers: {
        ...lobby.settings.modifiers,
        fullSongRange: enable
      }
    });
  }
  function setDubSongs(enable) {
    changeSettings({
      modifiers: {
        ...lobby.settings.modifiers,
        dubSongs: enable
      }
    });
  }
  async function setup$b() {
    registerCommand(
      "diff",
      () => ({
        shortHelp: "Change song difficulty range",
        longHelp: "Usage: /diff [min] [max]</br>Changes the song difficulty range to [min, max]."
      }),
      (args) => {
        const [min, max] = args.split(" ").map((x) => parseInt(x));
        if (min < max) changeDiff(min, max);
      }
    );
    registerCommand(
      "type",
      () => ({
        shortHelp: "Change song types",
        longHelp: 'Usage: /type [op|ed|in] ...</br>Changes the song types to the specified types. Use "op" for openings, "ed" for endings, and "in" for inserts.'
      }),
      (args) => {
        const types = args.split(" ").map((x) => x.toLowerCase());
        changeType(types);
      }
    );
    registerCommand(
      "songs",
      () => ({
        shortHelp: "Change number of songs",
        longHelp: "Usage: /songs [number]</br>Changes the number of songs in the game to [number]."
      }),
      (args) => {
        const songs = parseInt(args);
        if (!isNaN(songs)) changeSongs(songs);
      }
    );
    registerCommand(
      "teams",
      () => ({
        shortHelp: "Change team size",
        longHelp: "Usage: /teams [size]</br>Changes the team size to [size]."
      }),
      (args) => {
        const size = parseInt(args);
        if (!isNaN(size)) changeTeamSize(size);
      }
    );
    registerCommand(
      "genre",
      () => ({
        shortHelp: "Add or remove genre filter",
        longHelp: 'Usage: /genre [genre]|rem [genre]|none</br>Adds or removes the specified genre from the genre filter. Use "rem" to remove a genre, or "none" to clear all genres.'
      }),
      (args) => {
        const argsArr = args.split(" ");
        if (argsArr[0].toLocaleLowerCase() === "none") {
          removeAllGenres();
          return;
        }
        const isRemove = argsArr[0].toLocaleLowerCase() === "rem";
        const genre = argsArr.slice(isRemove ? 1 : 0).join(" ");
        const genreObj = getGenreObj(genre);
        const hasGenre = lobby.settings.genre.some(
          (g) => g.id.toString() === genreObj?.id.toString()
        );
        if (!genreObj) return;
        if (isRemove) {
          if (!hasGenre) return;
          removeGenre(genreObj);
        } else {
          if (hasGenre) return;
          addGenre(genreObj);
        }
      }
    );
    registerCommand(
      "roomsize",
      () => ({
        shortHelp: "Change room size",
        longHelp: "Usage: /roomsize [size]</br>Changes the room size to [size]."
      }),
      (args) => {
        const size = parseInt(args);
        if (isNaN(size)) {
          gameChat.systemMessage("Error: Invalid room size");
          return;
        }
        changeRoomSize(size);
      }
    );
    registerCommand(
      "gtime",
      () => ({
        shortHelp: "Change guess time",
        longHelp: "Usage: /gtime [seconds] [extra]</br>Changes the guess time to [seconds] with an optional extra time of [extra]."
      }),
      (args) => {
        const [timeStr, extraStr] = args.split(" ");
        const time = parseInt(timeStr);
        const extraTime = extraStr ? parseInt(extraStr) : 0;
        if (isNaN(time) || isNaN(extraTime)) {
          gameChat.systemMessage("Error: Invalid guess time or extra time");
          return;
        }
        changeGuessTime(time, extraTime);
      }
    );
    registerCommand(
      "dist",
      () => ({
        shortHelp: "Change watched distribution",
        longHelp: 'Usage: /dist [random|weighted|equal]</br>Changes the watched distribution to "random", "weighted", or "equal".'
      }),
      (args) => {
        switch (args) {
          case "random":
          case "r":
            changeWatchedDistribution(1);
            break;
          case "weighted":
          case "w":
            changeWatchedDistribution(2);
            break;
          case "equal":
          case "eq":
            changeWatchedDistribution(3);
            break;
          default:
            gameChat.systemMessage(
              'Error: Invalid distribution. Use "random", "weighted", or "equal".'
            );
        }
      }
    );
    registerCommand(
      "title",
      () => ({
        shortHelp: "Change room title",
        longHelp: "Usage: /title [new title]</br>Changes the room title to [new title]."
      }),
      (args) => {
        changeRoomTitle(args);
      }
    );
    registerCommand(
      "chants",
      () => ({
        shortHelp: "Toggle chantings",
        longHelp: "Usage: /chants [on|off]</br>Enables or disables chantings."
      }),
      (args) => {
        const mode = args.trim().toLocaleLowerCase();
        switch (mode) {
          case "on":
            toggleChantings(true);
            break;
          case "off":
            toggleChantings(false);
            break;
          default:
            gameChat.systemMessage("Error: Invalid argument for chants command.");
        }
      }
    );
    registerCommand(
      "fsr",
      () => ({
        shortHelp: "Toggle full song range",
        longHelp: "Usage: /fsr [on|off]</br>Enables or disables full song range."
      }),
      (args) => {
        const mode = args.trim().toLocaleLowerCase();
        switch (mode) {
          case "on":
            setFullSongRange(true);
            break;
          case "off":
            setFullSongRange(false);
            break;
          default:
            gameChat.systemMessage("Error: Invalid argument for fsr command.");
        }
      }
    );
    registerCommand(
      "dubs",
      () => ({
        shortHelp: "Toggle dub songs",
        longHelp: "Usage: /dubs [on|off]</br>Enables or disables dub songs. Without an argument, switches the current value."
      }),
      (args) => {
        const mode = args.trim().toLocaleLowerCase();
        switch (mode) {
          case "on":
            setDubSongs(true);
            break;
          case "off":
            setDubSongs(false);
            break;
          case "":
            setDubSongs(!lobby.settings.modifiers.dubSongs);
            break;
          default:
            gameChat.systemMessage("Error: Invalid argument for dubs command.");
        }
      }
    );
    registerCommand(
      "settings",
      () => ({
        shortHelp: "Check current game settings",
        longHelp: "Usage: /settings</br>Displays the current game settings."
      }),
      () => {
        const settings = lobby.settings;
        if (!settings) {
          gameChat.systemMessage("No game settings. Join a room first.");
          return;
        }
        const output = ["Current game settings:"];
        const add = (label, read) => {
          try {
            const value = read();
            if (value !== null) output.push(`${label}: ${value}`);
          } catch {
            output.push(`${label}: not available`);
          }
        };
        add("Room title", () => settings.roomName);
        add(
          "Song types",
          () => Object.entries(settings.songType.standardValue).filter(([, enabled]) => enabled).map(([type]) => type).join(", ")
        );
        add("Guess time", () => {
          const guessTime = settings.guessTime.randomOn ? `[${settings.guessTime.randomValue.join(", ")}]` : settings.guessTime.standardValue;
          const extraTime = settings.extraGuessTime.randomOn ? `[${settings.extraGuessTime.randomValue.join(", ")}]` : settings.extraGuessTime.standardValue;
          return `${guessTime}${extraTime ? " " + extraTime : ""}`;
        });
        add(
          "Difficulty",
          () => settings.songDifficulity.advancedOn ? settings.songDifficulity.advancedValue.join(" - ") : Object.entries(settings.songDifficulity.standardValue).filter(([, enabled]) => enabled).map(([level]) => level).join(", ")
        );
        add(
          "Watched distribution",
          () => settings.watchedDistribution === 1 ? "Random" : settings.watchedDistribution === 2 ? "Weighted" : "Equal"
        );
        add(
          "Modifiers",
          () => Object.entries(settings.modifiers).filter(([, enabled]) => enabled).map(([modifier]) => "</br>  - " + modifier).join("")
        );
        const stateToSymbol = {
          1: "+",
          2: "-",
          3: "?"
        };
        const describeFilters = (entries, filter) => entries.map(
          (entry) => stateToSymbol[entry.state] + filter.awesomepleteInstance._list.find(
            (item) => item.id.toString() === entry.id.toString()
          )?.name
        ).join(", ") || null;
        add("Genre", () => describeFilters(settings.genre, hostModal.genreFilter));
        add("Tags", () => describeFilters(settings.tags, hostModal.tagFilter));
        gameChat.systemMessage(output.join("</br>"));
      }
    );
  }

  const __vite_glob_0_13 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$b
  }, Symbol.toStringTag, { value: 'Module' }));

  const WORD_SEP = "    ";
  const LETTER_SEP = " ";
  function fixTitle(title) {
    return title.split(WORD_SEP).map((x) => x.replaceAll(LETTER_SEP, "")).join(" ");
  }
  async function setup$a() {
    const target = document.getElementById("qpAnimeName");
    if (!target) {
      throw new Error("qpAnimeName element not found");
    }
    const displayAnimeName = QuizInfoContainer.prototype.displayAnimeName;
    QuizInfoContainer.prototype.displayAnimeName = function(name, ...altLists) {
      const isHint = altLists.length === 0;
      target.style.letterSpacing = isHint ? ".3em" : "";
      return displayAnimeName.call(
        this,
        isHint ? fixTitle(name) : name,
        ...altLists
      );
    };
  }

  const __vite_glob_0_14 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$a
  }, Symbol.toStringTag, { value: 'Module' }));

  const STORAGE_KEY = "amqForcedVideoHost";
  const FORCED_CLASS = "amqForcedVideoHost";
  const CSS = `
.${FORCED_CLASS} {
  outline: 1px solid #4497ea;
  outline-offset: -1px;
  border-radius: 3px;
}
`;
  async function setup$9() {
    await ensureHostRowsLoaded();
    const hosts = videoResolver.hostOrder;
    let forcedHost = readStoredHost(hosts);
    _GM_addStyle(CSS);
    const originalUpdateActiveHost = videoResolver.updateActiveHost.bind(videoResolver);
    videoResolver.updateActiveHost = () => {
      if (!forcedHost) return originalUpdateActiveHost();
      sendHostChange(forcedHost);
      videoResolver.targetHost = forcedHost;
      return true;
    };
    const updateRowHighlights = () => {
      hosts.forEach((host) => {
        const row = videoConnectionStatus.hostStatusRows[host];
        if (row) row.$body[0].classList.toggle(FORCED_CLASS, host === forcedHost);
      });
    };
    const setForcedHost = (host) => {
      forcedHost = host;
      if (host) {
        localStorage.setItem(STORAGE_KEY, host);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      updateRowHighlights();
      videoResolver.updateActiveHost();
    };
    hosts.forEach((host) => {
      const row = videoConnectionStatus.hostStatusRows[host];
      if (!row) return;
      row.$body[0].addEventListener(
        "click",
        (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.stopPropagation();
          setForcedHost(forcedHost === host ? null : host);
        },
        true
      );
    });
    updateRowHighlights();
    if (forcedHost) videoResolver.updateActiveHost();
    registerCommand(
      "forcehost",
      () => ({
        shortHelp: "Pin the video host region",
        longHelp: `Usage: /forcehost [${hosts.join("|")}|off]</br>Pins the video host region instead of letting the game pick it by connection speed. You can also click a region in the video host tooltip to pin it (ctrl+click still retests it).</br>Current value: ${forcedHost ?? "not forced"}`
      }),
      (args) => {
        const value = args.trim();
        if (!value) {
          gameChat.systemMessage(
            `Forced video host: ${forcedHost ?? "not forced"} (current: ${videoResolver.targetHost})`
          );
          return;
        }
        if (/^(off|none|auto)$/i.test(value)) {
          setForcedHost(null);
          gameChat.systemMessage("Video host is no longer forced");
          return;
        }
        const host = hosts.find((h) => h.toLowerCase() === value.toLowerCase());
        if (!host) {
          gameChat.systemMessage(
            `Unknown video host. Options: ${hosts.join(", ")}, off`
          );
          return;
        }
        setForcedHost(host);
        gameChat.systemMessage(`Video host forced to ${host}`);
      }
    );
  }
  function sendHostChange(host) {
    if (videoResolver.targetHost === host) return;
    socket.sendCommand({
      command: "video host change",
      type: "settings",
      data: { host }
    });
  }
  function readStoredHost(hosts) {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && hosts.includes(stored) ? stored : null;
  }
  async function ensureHostRowsLoaded() {
    while (typeof videoResolver === "undefined" || videoResolver.hostOrder.length === 0 || Object.keys(videoConnectionStatus.hostStatusRows).length === 0) {
      await new Promise((res) => setTimeout(res, 1e3));
    }
  }

  const __vite_glob_0_15 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$9
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$8() {
    addListener("Jam Vote Result", (data) => {
      const selectedTheme = data.themeResult.option.name;
      const winnerVote = data.themeResult.vote.profileInfo.name;
      gameChat.systemMessage(
        `<span style="color: #A7C7E7;">Next theme: ${selectedTheme} (${winnerVote})</span>`
      );
      const [nOP, nED, nIN] = data.typeDistribution.sort((a, b) => a.typeId - b.typeId).map((x) => x.amount);
      gameChat.systemMessage(
        `<span style="color: #A7C7E7;">Song distribution: ${nOP} OP - ${nED} ED - ${nIN} IN</span>`
      );
    });
  }

  const __vite_glob_0_16 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$8
  }, Symbol.toStringTag, { value: 'Module' }));

  const KEYS = {
    ANSWER: "a",
    CHAT: "c",
    NAME_HINT: "n",
    INFO_HINT: "i",
    VOTE_SKIP: "s",
    NEXUS_ABILITY_SLOT_1: "1",
    NEXUS_ABILITY_SLOT_2: "2",
    NEXUS_ABILITY_SLOT_3: "3",
    NEXUS_ABILITY_SLOT_4: "4",
    NEXUS_TARGET_PREV_ENEMY: "arrowleft",
    NEXUS_TARGET_NEXT_ENEMY: "arrowright"
  };
  async function setup$7() {
    const focusAnswer = () => {
      const answerInput = $("#qpAnswerInput");
      answerInput.click();
      answerInput.focus();
      answerInput.select();
    };
    const focusChat = () => {
      const chatInput = quiz.gameMode === "Nexus" ? $("#nexusCoopChatInput") : $("#gcInput");
      chatInput.click();
      chatInput.select();
    };
    const nameHint = () => {
      const hintButton = $("#qpAmqHintName");
      hintButton.click();
    };
    const infoHint = () => {
      const hintButton = $("#qpAmqHintInfo");
      hintButton.click();
    };
    const useAbilityInNexus = (slot) => {
      if (quiz.gameMode !== "Nexus") return;
      socket.sendCommand({
        type: "nexus",
        command: "use avatar ability",
        data: { slot: parseInt(slot) }
      });
    };
    const voteSkip = () => {
      quiz.skipController.highlight = true;
      quiz.skipClicked();
    };
    const changeNexusTarget = (() => {
      let curTarget = 0;
      addListener("nexus game events", ({ events }) => {
        events.filter((ev) => ev.type === "newTurnAvatar").forEach((ev) => {
          curTarget = ev.attackTarget;
        });
      });
      createQuizPageMutationObserver(({ visible }) => {
        if (!visible || quiz.gameMode !== "Nexus") return;
        curTarget = [
          ...document.getElementById("qpAvatarRowEnemyContainer")?.children ?? []
        ].length - 1;
      });
      return (delta) => {
        if (quiz?.gameMode !== "Nexus") return;
        const validTargets = Object.values(quiz.enemyMap).filter(
          (enemy) => !!enemy && enemy.hp > 0
        ).map((enemy) => enemy.enemyPosition).sort((a, b) => a - b);
        const nxtTarget = delta > 0 ? validTargets.find((pos) => pos > curTarget) ?? validTargets[0] : validTargets.findLast((pos) => pos < curTarget) ?? validTargets[validTargets.length - 1];
        socket.sendCommand({
          type: "nexus",
          command: "target enemy",
          data: { enemyPosition: nxtTarget }
        });
        curTarget = nxtTarget;
      };
    })();
    document.addEventListener("keydown", (event) => {
      if (!event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case KEYS.NEXUS_TARGET_PREV_ENEMY:
            changeNexusTarget(-1);
            break;
          case KEYS.NEXUS_TARGET_NEXT_ENEMY:
            changeNexusTarget(1);
            break;
        }
      }
      if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case KEYS.ANSWER:
            focusAnswer();
            break;
          case KEYS.CHAT:
            focusChat();
            break;
          case KEYS.NAME_HINT:
            nameHint();
            break;
          case KEYS.INFO_HINT:
            infoHint();
            break;
          case KEYS.VOTE_SKIP:
            voteSkip();
            break;
          case KEYS.NEXUS_ABILITY_SLOT_1:
          case KEYS.NEXUS_ABILITY_SLOT_2:
          case KEYS.NEXUS_ABILITY_SLOT_3:
          case KEYS.NEXUS_ABILITY_SLOT_4:
            useAbilityInNexus(event.key);
            break;
        }
      }
    });
  }

  const __vite_glob_0_17 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$7
  }, Symbol.toStringTag, { value: 'Module' }));

  const CONTAINER_ID$1 = "amq-online-notifications-container";
  async function setup$6() {
    const containerEl = document.createElement("div");
    containerEl.id = CONTAINER_ID$1;
    containerEl.style.position = "absolute";
    containerEl.style.top = "0";
    containerEl.style.left = "0";
    containerEl.style.transform = "translateY(calc(-100% - 1rem))";
    containerEl.style.display = "flex";
    containerEl.style.flexDirection = "column";
    containerEl.style.width = "230px";
    containerEl.style.opacity = "0.9";
    document.getElementById("footerMenuBar")?.appendChild(containerEl);
    const createNotification = (text, type) => {
      const notifEl = document.createElement("span");
      notifEl.style.padding = "0.5rem";
      notifEl.style.backgroundColor = type === "online" ? "green" : "#3f3f3f";
      notifEl.textContent = text;
      const containerEl2 = document.getElementById(CONTAINER_ID$1);
      if (!containerEl2) return;
      containerEl2.appendChild(notifEl);
      setTimeout(() => {
        notifEl.remove();
      }, 5e3);
    };
    addListener("friend state change", (data) => {
      if (data.online) {
        createNotification(`${data.name} is online`, "online");
      } else {
        createNotification(`${data.name} went offline`, "offline");
      }
    });
  }

  const __vite_glob_0_18 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$6
  }, Symbol.toStringTag, { value: 'Module' }));

  const PLAYED_SONG_PATH = "/played-song";

  const VIDEO_CACHE_PORT = 8787;
  const VIDEO_CACHE_ORIGIN = `http://127.0.0.1:${VIDEO_CACHE_PORT}`;
  const CACHED_RESOLUTIONS = [720, 480];
  function cachedFile(files) {
    for (const resolution of CACHED_RESOLUTIONS) {
      const fileId = files?.[resolution];
      if (fileId && isCacheableFileId(fileId)) return { fileId, resolution };
    }
    return null;
  }
  function isCacheableFileId(fileId) {
    return /^[a-z0-9]+\.webm$/i.test(fileId);
  }
  function videoCacheUrl(fileId, downloadFrom) {
    const url = `${VIDEO_CACHE_ORIGIN}/video/${fileId}`;
    return downloadFrom ? `${url}?download=${encodeURIComponent(downloadFrom)}` : url;
  }
  function songType(type) {
    return type === 1 ? "OP" : type === 2 ? "ED" : "IN";
  }

  const OUTBOX_KEY = "amq-played-songs-outbox";
  const OUTBOX_LIMIT = 100;
  function newRound(startedAt) {
    return {
      startedAt,
      guessTime: null,
      extraGuessTime: null,
      answers: /* @__PURE__ */ new Map(),
      teamAnswers: /* @__PURE__ */ new Map(),
      answerTimes: /* @__PURE__ */ new Map(),
      hints: /* @__PURE__ */ new Map()
    };
  }
  let game = null;
  let round = newRound(null);
  function readOutbox() {
    try {
      const saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }
  function writeOutbox(records) {
    try {
      if (records.length) {
        localStorage.setItem(
          OUTBOX_KEY,
          JSON.stringify(records.slice(-OUTBOX_LIMIT))
        );
      } else {
        localStorage.removeItem(OUTBOX_KEY);
      }
    } catch (error) {
      console.warn("[playedSongs] Cannot keep unsent songs", error);
    }
  }
  let sending = false;
  async function flush() {
    if (sending) return;
    sending = true;
    try {
      let records = readOutbox();
      while (records.length) {
        const res = await fetch(VIDEO_CACHE_ORIGIN + PLAYED_SONG_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(records[0])
        }).catch(() => null);
        if (!res) break;
        if (!res.ok) {
          console.warn(
            `[playedSongs] The server refused ${records[0].recordId} (HTTP ${res.status})`
          );
          if (res.status !== 400) break;
        }
        records = readOutbox().filter((r) => r.recordId !== records[0].recordId);
        writeOutbox(records);
      }
    } finally {
      sending = false;
    }
  }
  function withoutPassword(settings) {
    const copy = structuredClone(settings ?? {});
    delete copy.password;
    return copy;
  }
  function buildRecord(result) {
    if (!game) return null;
    const spectator = Boolean(quiz.isSpectator);
    const songNumber = Number(quiz.infoContainer?.currentSongNumber) || null;
    const { songInfo, players: playerResults, ...rest } = result;
    const players = playerResults.map((entry) => {
      const id = entry.gamePlayerId;
      const player = quiz.players[id];
      const answer = round.answers.get(id);
      return {
        ...entry,
        gamePlayerId: id,
        name: player?.name ?? "",
        level: player?.level ?? null,
        teamNumber: quiz.teamMode ? player?.teamNumber ?? null : null,
        host: Boolean(player?.host),
        isSelf: Boolean(player?.isSelf),
        answer: answer?.answer ?? null,
        answerNumber: answer?.answerNumber ?? null,
        teamAnswer: round.teamAnswers.get(id) ?? null,
        answerTime: round.answerTimes.get(id) ?? null,
        hints: round.hints.get(id) ?? []
      };
    });
    const self = players.find((player) => player.isSelf);
    return {
      recordId: `${game.key}:${songNumber ?? Date.now()}`,
      gameKey: game.key,
      playedAt: (/* @__PURE__ */ new Date()).toISOString(),
      songStartedAt: round.startedAt,
      songNumber,
      totalSongs: game.totalSongs,
      self: {
        name: selfName,
        gamePlayerId: quiz.ownGamePlayerId ?? null,
        spectator,
        answer: self?.answer ?? null,
        correct: self ? Boolean(self.correct) : null
      },
      room: {
        gameId: lobby.gameId ?? null,
        soloMode: Boolean(quiz.soloMode),
        champGame: Boolean(quiz.champGame),
        gameMode: quiz.gameMode ?? null,
        teamMode: Boolean(quiz.teamMode),
        multipleChoice: game.multipleChoice,
        quizDescription: quiz.quizDescription ?? null,
        settings: withoutPassword(quiz.quizSettings)
      },
      song: songInfo,
      video: {
        startPoint: quizVideoController.getCurrentVideoStartPoint(),
        length: quizVideoController.getCurrentVideoLength(),
        host: quizVideoController.getCurrentPlayer()?.host ?? null,
        resolution: quizVideoController.getCurrentPlayer()?.resolution ?? null,
        guessMode: quizVideoController.getCurrentVideoGuessMode() ?? null,
        guessTime: round.guessTime,
        extraGuessTime: round.extraGuessTime
      },
      players,
      result: rest
    };
  }
  async function setup$5() {
    const originalSetupQuiz = quiz.setupQuiz;
    quiz.setupQuiz = function(...args) {
      const result = originalSetupQuiz.apply(this, args);
      const quizState = args[2];
      game = {
        key: crypto.randomUUID(),
        totalSongs: quizState?.totalSongNumbers ?? null,
        multipleChoice: Boolean(args[10])
      };
      round = newRound(null);
      return result;
    };
    addListener("quiz ready", (data) => {
      if (game) game.totalSongs = data?.numberOfSongs ?? game.totalSongs;
    });
    addListener("play next song", (data) => {
      round = newRound((/* @__PURE__ */ new Date()).toISOString());
      round.guessTime = data?.time ?? null;
      round.extraGuessTime = data?.extraGuessTime ?? null;
    });
    addListener("player answered", (data) => {
      for (const { gamePlayerIds, answerTime } of data) {
        for (const id of gamePlayerIds) round.answerTimes.set(id, answerTime);
      }
    });
    addListener("player answers", (data) => {
      for (const { gamePlayerId, answer, answerNumber } of data.answers) {
        round.answers.set(gamePlayerId, {
          answer,
          answerNumber: answerNumber ?? null
        });
      }
    });
    addListener("team member answer", ({ gamePlayerId, answer }) => {
      round.teamAnswers.set(gamePlayerId, answer);
    });
    addListener("quiz player hint used", ({ gamePlayerIds, hintId }) => {
      for (const id of gamePlayerIds) {
        round.hints.set(id, [...round.hints.get(id) ?? [], hintId]);
      }
    });
    addListener("answer results", (result) => {
      let record;
      try {
        record = buildRecord(result);
      } catch (error) {
        console.error("[playedSongs] Cannot read the song", error);
        return;
      }
      if (!record) return;
      writeOutbox([...readOutbox(), record]);
      void flush();
    });
    void flush();
  }

  const __vite_glob_0_19 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$5
  }, Symbol.toStringTag, { value: 'Module' }));

  const TOOLTIP_ID = "amq-shared-tooltip";
  const MAX_WIDTH = 420;
  const TooltipColors = {
    CORRECT_TITLE: "#5cb85c",
    PLAYER_ANSWER: "indianred",
    MUTED: "#a0a0a0"
  };
  function getTooltipEl() {
    const existing = document.getElementById(TOOLTIP_ID);
    if (existing instanceof HTMLElement) return existing;
    const tooltip = document.createElement("div");
    tooltip.id = TOOLTIP_ID;
    tooltip.style.position = "fixed";
    tooltip.style.display = "none";
    tooltip.style.zIndex = "10000";
    tooltip.style.backgroundColor = "rgba(27, 27, 27, 0.85)";
    tooltip.style.border = "1px solid rgba(77, 77, 77, 0.85)";
    tooltip.style.borderRadius = "4px";
    tooltip.style.boxShadow = "0 0 5px 2px rgb(0, 0, 0)";
    tooltip.style.color = "white";
    tooltip.style.padding = "0.4rem 0.6rem";
    tooltip.style.fontSize = "14px";
    tooltip.style.lineHeight = "1.4";
    tooltip.style.width = "max-content";
    tooltip.style.maxWidth = `${MAX_WIDTH}px`;
    tooltip.style.textAlign = "left";
    tooltip.style.pointerEvents = "none";
    document.body.appendChild(tooltip);
    return tooltip;
  }
  function makeTooltipLine(...parts) {
    const line = document.createElement("div");
    line.style.overflowWrap = "break-word";
    line.append(...parts);
    return line;
  }
  function makeColoredText(text, color) {
    const span = document.createElement("span");
    span.style.color = color;
    span.innerText = text;
    return span;
  }
  function showTooltip(lines, anchor) {
    const tooltip = getTooltipEl();
    tooltip.replaceChildren(...lines);
    tooltip.style.display = "block";
    const { width, height } = tooltip.getBoundingClientRect();
    const left = Math.min(
      Math.max(anchor.left + anchor.width / 2 - width / 2, 4),
      window.innerWidth - width - 4
    );
    const top = anchor.top - height - 6 >= 0 ? anchor.top - height - 6 : anchor.bottom + 6;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTooltip() {
    const tooltip = document.getElementById(TOOLTIP_ID);
    if (tooltip instanceof HTMLElement) {
      tooltip.style.display = "none";
    }
  }
  const hoverGroups = /* @__PURE__ */ new Map();
  let hoveredEl = null;
  let listening = false;
  const containsPoint = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  function findHoverTarget(x, y) {
    for (const [group, targets] of hoverGroups) {
      const live = targets.filter((target) => target.el.isConnected);
      if (live.length !== targets.length) {
        hoverGroups.set(group, live);
      }
      for (const target of live) {
        if (!containsPoint(target.el.getBoundingClientRect(), x, y)) continue;
        if (target.clipEl && !containsPoint(target.clipEl.getBoundingClientRect(), x, y)) {
          continue;
        }
        return target;
      }
    }
  }
  function ensureHoverListener() {
    if (listening) return;
    listening = true;
    document.addEventListener("mousemove", (event) => {
      const target = findHoverTarget(event.clientX, event.clientY);
      if (!target) {
        hoveredEl = null;
        hideTooltip();
        return;
      }
      if (target.el === hoveredEl) return;
      hoveredEl = target.el;
      showTooltip(target.getLines(), target.el.getBoundingClientRect());
    });
  }
  function setHoverTargets(group, targets) {
    ensureHoverListener();
    hoverGroups.set(group, targets);
    hoveredEl = null;
  }
  function addHoverTarget(group, target) {
    ensureHoverListener();
    const targets = hoverGroups.get(group);
    if (targets) {
      targets.push(target);
    } else {
      hoverGroups.set(group, [target]);
    }
  }

  const LOCAL_STORAGE_KEY = "amq-player-stats";
  const CONTAINER_CLASS = "player-stats-container";
  const HOVER_GROUP$1 = "player-stats";
  const STACK_ORDER = 0;
  const MAX_TRACKED_MISSES = 20;
  const CONTAINER_WIDTH = "12rem";
  const LIST_STATUS_LOOTED$1 = 6;
  function loadLocalStorage() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return JSON.parse(raw ?? "{}");
    } catch {
      console.error("amq-player-stats: error while loading stats");
      return {};
    }
  }
  function updateLocalStorage(data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }
  const readStats = (map, playerName) => map[playerName] ?? { correct: 0, total: 0 };
  const getOrCreateStats = (map, playerName) => map[playerName] ??= { correct: 0, total: 0 };
  const formatPercent = ({ correct, total }) => total === 0 ? "-" : `${(correct / total * 100).toFixed(2)}%`;
  const formatFull = (stats) => `${stats.correct}/${stats.total} (${formatPercent(stats)})`;
  function makeMissEntry({ anime, answer }) {
    const entry = document.createElement("div");
    entry.style.marginTop = "0.2rem";
    const answerLine = makeTooltipLine(
      makeColoredText("→ ", TooltipColors.MUTED),
      makeColoredText(answer || "(no answer)", TooltipColors.PLAYER_ANSWER)
    );
    answerLine.style.paddingLeft = "1rem";
    answerLine.style.textIndent = "-1rem";
    answerLine.style.marginLeft = "0.6rem";
    entry.append(
      makeTooltipLine(makeColoredText(anime, TooltipColors.CORRECT_TITLE)),
      answerLine
    );
    return entry;
  }
  function getPlayerNames() {
    const names = Object.values(quiz.players ?? []).map((player) => player._name);
    if (names.length > 0) return names;
    return [...document.querySelectorAll(".qpAvatarName")].filter((el) => el instanceof HTMLElement).map((el) => el.innerText);
  }
  function removeAllContainers() {
    [...document.querySelectorAll("." + CONTAINER_CLASS)].forEach(
      (el) => el.remove()
    );
  }
  async function setup$4() {
    const allTime = loadLocalStorage();
    let session = {};
    let game = {};
    let gameMisses = {};
    let songAnswers = {};
    let active = true;
    let hoverTargets = [];
    const getMissLines = (playerName) => {
      const misses = gameMisses[playerName] ?? [];
      if (misses.length === 0) {
        return [makeTooltipLine("No missed list songs this game")];
      }
      return [
        makeTooltipLine(
          makeColoredText(
            `Missed this game (last ${MAX_TRACKED_MISSES}):`,
            TooltipColors.MUTED
          )
        ),
        ...misses.map(makeMissEntry)
      ];
    };
    const renderPlayer = (playerName) => {
      const avatarContainer = getPlayerAvatarContainer(playerName);
      if (!avatarContainer) return;
      const container = getAvatarStackSlot(
        avatarContainer,
        CONTAINER_CLASS,
        STACK_ORDER
      );
      container.style.alignSelf = "center";
      container.style.boxSizing = "border-box";
      container.style.width = CONTAINER_WIDTH;
      container.style.backgroundColor = "#1b1b1b";
      container.style.opacity = "0.8";
      container.style.color = "white";
      container.style.padding = "0.3rem 0.6rem";
      container.style.rowGap = "0";
      container.style.textAlign = "center";
      container.style.fontSize = "0.9rem";
      container.style.lineHeight = "1.3";
      container.style.whiteSpace = "nowrap";
      const gameStats = readStats(game, playerName);
      const sessionStats = readStats(session, playerName);
      const allTimeStats = readStats(allTime, playerName);
      const lines = [
        ["Game", formatFull(gameStats), () => getMissLines(playerName)],
        [
          "Session",
          formatPercent(sessionStats),
          () => [
            makeTooltipLine(
              `Session: ${formatFull(readStats(session, playerName))}`
            )
          ]
        ],
        [
          "All time",
          formatPercent(allTimeStats),
          () => [
            makeTooltipLine(
              `All time: ${formatFull(readStats(allTime, playerName))}`
            )
          ]
        ]
      ];
      container.replaceChildren(
        ...lines.map(([label, text, getLines]) => {
          const el = document.createElement("div");
          el.innerText = `${label}: ${text}`;
          hoverTargets.push({ el, getLines });
          return el;
        })
      );
    };
    const render = () => {
      hoverTargets = [];
      hideTooltip();
      if (active) {
        getPlayerNames().forEach(renderPlayer);
      }
      setHoverTargets(HOVER_GROUP$1, hoverTargets);
    };
    const registerSongResults = (data) => {
      const anime = data.songInfo.animeNames.romaji;
      for (const player of data.players) {
        if (!player.listStatus || player.listStatus === LIST_STATUS_LOOTED$1) {
          continue;
        }
        const playerName = getPlayerName(player.gamePlayerId);
        if (!playerName) continue;
        for (const map of [game, session, allTime]) {
          const stats = getOrCreateStats(map, playerName);
          stats.total += 1;
          if (player.correct) {
            stats.correct += 1;
          }
        }
        if (player.correct) continue;
        const misses = gameMisses[playerName] ??= [];
        misses.push({ anime, answer: songAnswers[player.gamePlayerId] ?? "" });
        if (misses.length > MAX_TRACKED_MISSES) {
          misses.shift();
        }
      }
      updateLocalStorage(allTime);
    };
    addListener("quiz ready", () => {
      game = {};
      gameMisses = {};
      render();
    });
    addListener("play next song", () => {
      songAnswers = {};
      render();
    });
    addListener("player answers", (data) => {
      data.answers.forEach(({ answer, gamePlayerId }) => {
        songAnswers[gamePlayerId] = answer;
      });
    });
    addListener("player name change", () => render());
    addListener("answer results", (data) => {
      registerSongResults(data);
      render();
    });
    registerCommand(
      "stats",
      () => ({
        shortHelp: "Toggle the player stats display",
        longHelp: `Usage: /stats</br>Toggles the own list accuracy box shown under each player's avatar.</br>Usage: /stats reset</br>Resets the current session (and current game) stats. All time stats are never cleared.</br>Current value: ${active ? "enabled" : "disabled"}`
      }),
      (args) => {
        const arg = args.trim();
        if (arg === "reset") {
          session = {};
          game = {};
          gameMisses = {};
          render();
          gameChat.systemMessage("Player stats: session stats reset");
          return;
        }
        if (arg !== "") {
          gameChat.systemMessage(`Player stats: unknown argument "${arg}"`);
          return;
        }
        active = !active;
        if (!active) {
          removeAllContainers();
        }
        render();
        gameChat.systemMessage(`Player stats: ${active ? "enabled" : "disabled"}`);
      }
    );
  }

  const __vite_glob_0_20 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$4
  }, Symbol.toStringTag, { value: 'Module' }));

  async function setup$3() {
    const options = {
      maxHeight: "28rem"
    };
    const CONTAINER_ID = "__amq-show-extra-song-info-container";
    const LAST_SEEN_CONTAINER_ID = "__amq-show-extra-song-info-last-seen-container";
    const LOCAL_STORAGE_KEY = "amq-extra-song-info";
    function removeContainerIfExists() {
      document.getElementById(LAST_SEEN_CONTAINER_ID)?.remove();
      const container = document.getElementById(CONTAINER_ID);
      container?.remove();
    }
    function loadLocalStorage() {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const data = JSON.parse(raw ?? "{}");
        return data;
      } catch {
        return null;
      }
    }
    function updateLocalStorage(data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
    function getAndUpdateLastSeen(songInfo) {
      const key = songInfo.videoTargetMap.catbox[720] ?? songInfo.videoTargetMap.catbox[480] ?? songInfo.videoTargetMap.catbox[0] ?? null;
      const data = loadLocalStorage();
      if (!key || data === null) return "Error";
      const last = data[key];
      const now = Date.now();
      data[key] = now;
      updateLocalStorage(data);
      if (!last) return "never";
      let diff = (now - last) / 1e3;
      const units = [
        { label: "second", step: 60 },
        { label: "minute", step: 60 },
        { label: "hour", step: 24 },
        { label: "day", step: 30 },
        { label: "month", step: 12 },
        { label: "year", step: Infinity }
      ];
      for (const unit of units) {
        if (diff >= unit.step) {
          diff /= unit.step;
        } else {
          const val = Math.round(diff);
          return `${val} ${unit.label + (val === 1 ? "" : "s")} ago`;
        }
      }
      return "Error";
    }
    addListener("answer results", (results) => {
      removeContainerIfExists();
      const container = document.createElement("div");
      container.classList.add("row");
      container.id = CONTAINER_ID;
      Object.assign(container.style, {
        padding: "0.5rem",
        borderTop: "solid 1px black",
        marginTop: "5px",
        maxHeight: options.maxHeight,
        overflowY: "auto"
      });
      document.getElementById(LAST_SEEN_CONTAINER_ID)?.remove();
      const lastSeen = getAndUpdateLastSeen(results.songInfo);
      const lastSeenContainer = document.createElement("div");
      lastSeenContainer.id = LAST_SEEN_CONTAINER_ID;
      const lastSeenLabel = document.createElement("span");
      lastSeenLabel.innerText = "Last seen:";
      Object.assign(lastSeenLabel.style, {
        fontWeight: "bold",
        marginRight: "0.5rem"
      });
      lastSeenContainer.append(lastSeenLabel, lastSeen);
      document.getElementById("qpSongInfoContainer")?.insertBefore(
        lastSeenContainer,
        document.getElementById("qpSongInfoLinkRow")
      );
      const correctAnswersContainer = document.createElement("div");
      Object.assign(correctAnswersContainer.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start"
      });
      const correctAnswersLabel = document.createElement("span");
      correctAnswersLabel.innerText = "Correct Answers";
      Object.assign(correctAnswersLabel.style, {
        marginBottom: "0.5rem",
        alignSelf: "center",
        fontWeight: "bold"
      });
      correctAnswersContainer.appendChild(correctAnswersLabel);
      results.songInfo.altAnimeNames.forEach((name) => {
        const node = document.createElement("span");
        node.innerText = `- ${name}`;
        Object.assign(node.style, {
          fontSize: "12px",
          textAlign: "left"
        });
        correctAnswersContainer.appendChild(node);
      });
      container.appendChild(correctAnswersContainer);
      if (results.songInfo.altAnimeNamesAnswers.length > 0) {
        const alternativeAnswersContainer = document.createElement("div");
        Object.assign(alternativeAnswersContainer.style, {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          marginTop: "1rem"
        });
        const alternativeAnswersLabel = document.createElement("span");
        alternativeAnswersLabel.innerText = "Alternative Answers";
        Object.assign(alternativeAnswersLabel.style, {
          marginBottom: "0.5rem",
          alignSelf: "center",
          fontWeight: "bold"
        });
        alternativeAnswersContainer.appendChild(alternativeAnswersLabel);
        results.songInfo.altAnimeNamesAnswers.forEach((name) => {
          const node = document.createElement("span");
          node.innerText = `- ${name}`;
          Object.assign(node.style, {
            fontSize: "12px",
            textAlign: "left"
          });
          alternativeAnswersContainer.appendChild(node);
        });
        container.appendChild(alternativeAnswersContainer);
      }
      document.getElementById("qpRateOuterContainer")?.parentNode?.appendChild(container);
    });
    addListener("play next song", () => {
      removeContainerIfExists();
    });
    addListener("quiz over", () => {
      removeContainerIfExists();
    });
    createQuizPageMutationObserver(({ visible }) => {
      if (!visible) removeContainerIfExists();
    });
  }

  const __vite_glob_0_21 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$3
  }, Symbol.toStringTag, { value: 'Module' }));

  const CONTAINER_ID = "amqSongHistoryContainer";
  const SCROLL_ID = "amqSongHistoryScroll";
  const TABLE_ID = "amqSongHistoryTable";
  const HOVER_GROUP = "song-history";
  const ONLY_MISTAKES_STORAGE_KEY = "amq-song-history-only-mistakes";
  const MAX_ROWS = 100;
  const LIST_STATUS_LOOTED = 6;
  const SIDE_MARGIN = 20;
  const VIDEO_CONTAINER_ID = "qpVideoContainer";
  const STANDINGS_GAP = 20;
  const css$1 = `
#${CONTAINER_ID} {
  position: absolute;
  z-index: 5;
  /* Nexus sets pointer-events: none on everything outside its own whitelist */
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  max-height: 200px;
  padding: 4px 6px 6px;
  border-radius: 5px;
  background-color: rgba(27, 27, 27, 0.7);
}

#${CONTAINER_ID} > .header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin: 2px 0 4px;
}

#${CONTAINER_ID} > .header > h5 {
  grid-column: 2;
  margin: 0;
}

#${CONTAINER_ID} > .header > label {
  grid-column: 3;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 11px;
  font-weight: normal;
  opacity: 0.85;
  cursor: pointer;
}

#${CONTAINER_ID} > .header input {
  margin: 0;
}

/* Centers the capital letters on the checkbox, whatever the font's metrics */
#${CONTAINER_ID} > .header span {
  line-height: 1;
  text-box: trim-both cap alphabetic;
}

#${SCROLL_ID} {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #6d6d6d rgba(0, 0, 0, 0.3);
}

#${SCROLL_ID}::-webkit-scrollbar {
  width: 8px;
}

#${SCROLL_ID}::-webkit-scrollbar-track {
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

#${SCROLL_ID}::-webkit-scrollbar-thumb {
  background-color: #6d6d6d;
  border-radius: 4px;
}

#${SCROLL_ID}::-webkit-scrollbar-thumb:hover {
  background-color: #8a8a8a;
}

#${TABLE_ID} {
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
}

/* Headers share the cells' alignment so each column reads as one strip */
#${TABLE_ID} th,
#${TABLE_ID} td {
  padding: 1px 3px;
  overflow-wrap: break-word;
  vertical-align: top;
  text-align: left;
}

#${TABLE_ID} thead th {
  position: sticky;
  top: 0;
  background-color: #1b1b1b;
  font-weight: normal;
  opacity: 0.8;
}

#${TABLE_ID} tr.correctGuess {
  background-color: #5cb85c77;
}

#${TABLE_ID} tr.wrongGuess {
  background-color: #ac292577;
}

#${TABLE_ID} tbody tr:not(.gameSeparator):hover {
  outline: 1px solid #8a8a8a;
}

#${TABLE_ID} tr.gameSeparator td {
  padding: 2px 3px;
  text-align: center;
  font-size: 11px;
  color: #a9a9a9;
  background-color: rgba(0, 0, 0, 0.45);
  border-top: 1px solid #6d6d6d;
}

#${CONTAINER_ID}.onlyMistakes tbody tr:not(.wrongGuess):not(.gameSeparator) {
  display: none;
}

/* A game without mistakes hides its separator too */
#${CONTAINER_ID}.onlyMistakes tbody:not(:has(tr.wrongGuess)) {
  display: none;
}

/* The sample is a fixed-shape timestamp, so it never needs to wrap */
#${TABLE_ID} th:last-child,
#${TABLE_ID} td:last-child {
  white-space: nowrap;
  text-align: right;
}
`;
  const COLUMNS = [
    { label: "Anime", width: "38%" },
    { label: "Type", width: "15%" },
    { label: "Song", width: "25%" },
    { label: "Sample", width: "22%" }
  ];
  function createPanel() {
    const standingContainer = document.getElementById("qpStandingContainer");
    if (!standingContainer) {
      throw new Error("Could not find the standings container");
    }
    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    const header = document.createElement("div");
    header.className = "header";
    container.appendChild(header);
    const title = document.createElement("h5");
    title.textContent = "Song History";
    header.appendChild(title);
    const onlyMistakes = document.createElement("input");
    onlyMistakes.type = "checkbox";
    onlyMistakes.checked = localStorage.getItem(ONLY_MISTAKES_STORAGE_KEY) === "true";
    container.classList.toggle("onlyMistakes", onlyMistakes.checked);
    onlyMistakes.addEventListener("change", () => {
      container.classList.toggle("onlyMistakes", onlyMistakes.checked);
      localStorage.setItem(
        ONLY_MISTAKES_STORAGE_KEY,
        String(onlyMistakes.checked)
      );
    });
    const onlyMistakesLabel = document.createElement("label");
    const onlyMistakesText = document.createElement("span");
    onlyMistakesText.textContent = "Only mistakes";
    onlyMistakesLabel.append(onlyMistakes, onlyMistakesText);
    header.appendChild(onlyMistakesLabel);
    const scroll = document.createElement("div");
    scroll.id = SCROLL_ID;
    container.appendChild(scroll);
    const table = document.createElement("table");
    table.id = TABLE_ID;
    scroll.appendChild(table);
    const colGroup = document.createElement("colgroup");
    const headerRow = document.createElement("tr");
    for (const { label, width } of COLUMNS) {
      const col = document.createElement("col");
      col.style.width = width;
      colGroup.appendChild(col);
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    }
    table.appendChild(colGroup);
    const head = document.createElement("thead");
    head.appendChild(headerRow);
    table.appendChild(head);
    standingContainer.after(container);
    watchGeometry(container, standingContainer);
    return { table, head, scroll };
  }
  function createGameBody(startTime) {
    const body = document.createElement("tbody");
    const separator = document.createElement("tr");
    separator.className = "gameSeparator";
    const cell = document.createElement("td");
    cell.colSpan = COLUMNS.length;
    cell.textContent = startTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    separator.appendChild(cell);
    body.appendChild(separator);
    return { body, separator };
  }
  const SONG_ROW_SELECTOR = "tbody tr:not(.gameSeparator)";
  function removeOldestRows(table) {
    const rows = table.querySelectorAll(SONG_ROW_SELECTOR);
    for (const row of [...rows].slice(MAX_ROWS)) {
      const body = row.parentElement;
      row.remove();
      if (body?.childElementCount === 1) body.remove();
    }
  }
  function syncGeometry(container, standingContainer) {
    const videoRect = document.getElementById(VIDEO_CONTAINER_ID)?.getBoundingClientRect();
    const standingRect = standingContainer.getBoundingClientRect();
    if (!videoRect || videoRect.width === 0 || standingRect.width === 0) {
      return;
    }
    const bandRight = videoRect.left - SIDE_MARGIN;
    const center = (SIDE_MARGIN + bandRight) / 2;
    const currentMargin = parseFloat(getComputedStyle(standingContainer).marginLeft) || 0;
    const standingLeft = center - standingRect.width / 2;
    standingContainer.style.marginLeft = `${currentMargin + standingLeft - standingRect.left}px`;
    const width = Math.max(bandRight - SIDE_MARGIN, standingRect.width);
    const origin = (container.offsetParent ?? document.body).getBoundingClientRect();
    container.style.width = `${width}px`;
    container.style.left = `${center - width / 2 - origin.left}px`;
    container.style.top = `${standingRect.bottom + STANDINGS_GAP - origin.top}px`;
  }
  function watchGeometry(container, standingContainer) {
    const sync = () => syncGeometry(container, standingContainer);
    const resync = () => [0, 100, 500, 1500].forEach((ms) => setTimeout(sync, ms));
    const observer = new ResizeObserver(sync);
    observer.observe(standingContainer);
    const videoContainer = document.getElementById(VIDEO_CONTAINER_ID);
    if (videoContainer) {
      observer.observe(videoContainer);
    }
    if (container.parentElement) {
      observer.observe(container.parentElement);
    }
    window.addEventListener("resize", sync);
    createQuizPageMutationObserver(({ visible }) => {
      if (visible) resync();
    });
    resync();
  }
  const getAnimeName = (songInfo) => options.useRomajiNames ? songInfo.animeNames.romaji : songInfo.animeNames.english;
  function getTypeText(songInfo) {
    const { key, data } = convertTypeInfoToText(
      songInfo.type,
      songInfo.typeNumber,
      null,
      null,
      "song_history"
    );
    return localizationHandler.translate(key, data, true);
  }
  function getSampleText() {
    const startPoint = quizVideoController.getCurrentVideoStartPoint();
    const videoLength = quizVideoController.getCurrentVideoLength();
    if (startPoint === null || videoLength === null) {
      return "-";
    }
    return `${convertSecondsToTimeString(startPoint)}/${convertSecondsToTimeString(
    videoLength
  )}`;
  }
  function formatVintage(vintage) {
    if (!vintage) return "?";
    return typeof vintage === "string" ? vintage : localizationHandler.translate(vintage.key, vintage.data);
  }
  const getListPlayers = (data) => data.players.filter(
    (player) => player.listStatus && player.listStatus !== LIST_STATUS_LOOTED
  ).map((player) => ({
    name: getPlayerName(player.gamePlayerId),
    correct: player.correct
  })).filter((player) => !!player.name);
  function makeListPlayerLines(listPlayers, totalPlayers) {
    if (listPlayers.length === 0) return [];
    const names = listPlayers.flatMap((player, index) => [
      ...index === 0 ? [] : [", "],
      makeColoredText(
        player.name,
        player.correct ? TooltipColors.CORRECT_TITLE : TooltipColors.PLAYER_ANSWER
      )
    ]);
    return [
      makeTooltipLine(
        makeColoredText(
          `In list (${listPlayers.length}/${totalPlayers}): `,
          TooltipColors.MUTED
        )
      ),
      makeTooltipLine(...names)
    ];
  }
  function buildDetailLines(data, sample, listPlayers) {
    const { songInfo } = data;
    const { romaji, english } = songInfo.animeNames;
    const correctCount = data.players.filter((player) => player.correct).length;
    const difficulty = typeof songInfo.animeDifficulty === "number" ? `${songInfo.animeDifficulty.toFixed(2)}%` : "unrated";
    const lines = [
      makeTooltipLine(makeColoredText(romaji, TooltipColors.CORRECT_TITLE))
    ];
    if (english && english !== romaji) {
      lines.push(makeTooltipLine(makeColoredText(english, TooltipColors.MUTED)));
    }
    const details = [
      ["Song", songInfo.songName],
      ["Artist", songInfo.artist],
      ["Type", getTypeText(songInfo)],
      ["Vintage", formatVintage(songInfo.vintage)],
      ["Anime type", songInfo.animeType],
      ["Rating", songInfo.animeScore == null ? "?" : `${songInfo.animeScore}/10`],
      ["Difficulty", difficulty],
      ["Guessed by", `${correctCount}/${data.players.length}`],
      ["Sample", sample]
    ];
    for (const [label, value] of details) {
      lines.push(
        makeTooltipLine(
          makeColoredText(`${label}: `, TooltipColors.MUTED),
          value ?? "-"
        )
      );
    }
    lines.push(...makeListPlayerLines(listPlayers, data.players.length));
    return lines;
  }
  function getDetailLines(data, sample, listPlayers) {
    try {
      return buildDetailLines(data, sample, listPlayers);
    } catch (error) {
      console.error("amq-song-history: could not build song details", error);
      return [makeTooltipLine("Could not load song details")];
    }
  }
  function createRow(data, scroll) {
    const row = document.createElement("tr");
    const selfResult = data.players.find(
      (player) => quiz.players[player.gamePlayerId]?.isSelf
    );
    const correctGuess = selfResult?.correct === true;
    if (correctGuess) {
      row.classList.add("correctGuess");
    } else if (!quiz.isSpectator) {
      row.classList.add("wrongGuess");
    }
    const sample = getSampleText();
    const values = [
      getAnimeName(data.songInfo),
      getTypeText(data.songInfo),
      data.songInfo.songName,
      sample
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    const listPlayers = getListPlayers(data);
    addHoverTarget(HOVER_GROUP, {
      el: row,
      clipEl: scroll,
      getLines: () => getDetailLines(data, sample, listPlayers)
    });
    return row;
  }
  async function setup$2() {
    _GM_addStyle(css$1);
    const { table, head, scroll } = createPanel();
    let gameStartTime = null;
    let currentGame = null;
    addListener("quiz ready", () => {
      gameStartTime = /* @__PURE__ */ new Date();
      currentGame = null;
    });
    addListener("answer results", (data) => {
      if (!currentGame) {
        currentGame = createGameBody(gameStartTime ?? /* @__PURE__ */ new Date());
        gameStartTime = null;
        head.after(currentGame.body);
      }
      currentGame.separator.after(createRow(data, scroll));
      removeOldestRows(table);
    });
  }

  const __vite_glob_0_22 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$2
  }, Symbol.toStringTag, { value: 'Module' }));

  const BOX_CLASS = "amq-typing-speed";
  const CHARACTERS_PER_WORD = 5;
  const css = `
.${BOX_CLASS} {
  position: absolute;
  bottom: 100%;
  right: 0;
  padding: 0.1rem 0.7rem;
  background-color: #1b1b1b;
  opacity: 0.8;
  color: #a9a9a9;
  font-size: 1.1rem;
  white-space: nowrap;
  pointer-events: none;
}

.${BOX_CLASS} > .value {
  color: skyblue;
  font-size: 1.2rem;
}
`;
  function showSpeed(gamePlayerId, wpm) {
    const answerContainer = getPlayerAvatarContainer(
      getPlayerName(gamePlayerId)
    )?.querySelector(".qpAvatarAnswerContainer");
    if (!answerContainer) return;
    let box = answerContainer.querySelector("." + BOX_CLASS);
    if (!box) {
      box = document.createElement("div");
      box.className = BOX_CLASS;
      const value2 = document.createElement("span");
      value2.className = "value";
      box.append(value2, " WPM");
      answerContainer.appendChild(box);
    }
    const value = box.querySelector(".value");
    if (value) value.textContent = String(Math.round(wpm));
  }
  const removeBoxes = () => document.querySelectorAll("." + BOX_CLASS).forEach((el) => el.remove());
  async function setup$1() {
    _GM_addStyle(css);
    const startTimes = /* @__PURE__ */ new Map();
    addListener("play next song", () => {
      startTimes.clear();
      removeBoxes();
    });
    addListener("team member answer", ({ answer, gamePlayerId }) => {
      if (!isDropdownDisabled()) {
        startTimes.clear();
        removeBoxes();
        return;
      }
      if (answer.trim() === "") {
        startTimes.delete(gamePlayerId);
        return;
      }
      const now = performance.now();
      const startTime = startTimes.get(gamePlayerId);
      if (startTime === void 0) {
        startTimes.set(gamePlayerId, now);
        return;
      }
      const minutes = (now - startTime) / 6e4;
      if (minutes === 0) return;
      showSpeed(gamePlayerId, answer.length / CHARACTERS_PER_WORD / minutes);
    });
  }

  const __vite_glob_0_23 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup$1
  }, Symbol.toStringTag, { value: 'Module' }));

  const CHECK_TIMEOUT_MS = 300;
  const MP3_RESOLUTION = 0;
  const DISABLED_KEY = "amq-video-cache-disabled";
  let disabled = readDisabled();
  function readDisabled() {
    try {
      return localStorage.getItem(DISABLED_KEY) === "1";
    } catch {
      return false;
    }
  }
  function setDisabled(value) {
    disabled = value;
    try {
      if (value) localStorage.setItem(DISABLED_KEY, "1");
      else localStorage.removeItem(DISABLED_KEY);
    } catch {
    }
  }
  function isActive() {
    return !disabled && qualityController.targetResolution !== MP3_RESOLUTION;
  }
  function statusText() {
    if (disabled) return "off (AMQ default playback)";
    if (!isActive()) return "on, but paused: the quality setting is mp3";
    return "on";
  }
  const MP3_REASONS = {
    miss: "Cache miss: downloading the video for next time",
    offline: "Cache server offline",
    timeout: "Cache server did not answer in time",
    failed: "The cached video did not play"
  };
  const NO_VIDEO_REASON = "This song has no 720p or 480p video";
  const ENCRYPTED_REASON = "Encrypted song: the cache is not used";
  const UNCHECKED_REASON = "The cache was not checked for this song";
  const answers = /* @__PURE__ */ new Map();
  const checks = /* @__PURE__ */ new Map();
  const mp3Reasons = /* @__PURE__ */ new WeakMap();
  function cacheTarget(videoMap, hostKeys) {
    if (!videoMap) return null;
    for (const hostKey of hostKeys) {
      const file = cachedFile(videoMap[hostKey]);
      if (file) return { ...file, hostKey };
    }
    return null;
  }
  function songTarget(songInfo) {
    if (!songInfo || songInfo.encrypted) return null;
    return cacheTarget(songInfo.videoMap, options.getHostPriorityList());
  }
  async function askCache(fileId) {
    try {
      const res = await fetch(videoCacheUrl(fileId, videoResolver.targetHost), {
        method: "HEAD",
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
      });
      return res.ok ? "cached" : "miss";
    } catch (error) {
      return error.name === "TimeoutError" ? "timeout" : "offline";
    }
  }
  function startCheck(fileId) {
    answers.delete(fileId);
    const check = askCache(fileId).then((result) => {
      answers.set(fileId, result);
      checks.delete(fileId);
      return result;
    });
    checks.set(fileId, check);
    if (answers.size > 500) answers.delete(answers.keys().next().value);
    return check;
  }
  function mp3Reason(player) {
    if (player.encrypted) return ENCRYPTED_REASON;
    const target = cacheTarget(player.videoMap, player.hostOrder);
    if (!target) return NO_VIDEO_REASON;
    const answer = answers.get(target.fileId);
    if (!answer || answer === "cached") return UNCHECKED_REASON;
    return MP3_REASONS[answer];
  }
  let reasonLabel = null;
  let revealed = false;
  function createReasonLabel() {
    const soundOnly = document.getElementById("qpVideoSoundOnly");
    if (!soundOnly) return;
    reasonLabel = document.createElement("div");
    Object.assign(reasonLabel.style, {
      position: "absolute",
      left: "0",
      right: "0",
      top: "calc(50% + 45px)",
      textAlign: "center",
      fontSize: "18px",
      opacity: "0.8",
      zIndex: "-1"
    });
    soundOnly.after(reasonLabel);
  }
  function showReason() {
    if (!reasonLabel) return;
    const player = quizVideoController.getCurrentPlayer();
    const reason = revealed && player ? mp3Reasons.get(player) : null;
    reasonLabel.textContent = reason ?? "";
  }
  function revealedSong(songInfo) {
    const { annSongId, annId } = songInfo;
    if (annSongId === void 0 || annId === void 0) return null;
    const videoMap = songInfo.videoTargetMap;
    const target = cacheTarget(videoMap, options.getHostPriorityList());
    if (!target) return null;
    const type = songType(songInfo.type);
    return {
      fileId: target.fileId,
      song: {
        annSongId,
        annId,
        anime: songInfo.animeNames.romaji,
        artist: songInfo.artist,
        name: songInfo.songName,
        type,
        typeNumber: type === "IN" ? null : songInfo.typeNumber || null,
        difficulty: typeof songInfo.animeDifficulty === "number" ? songInfo.animeDifficulty : null,
        altAnswers: [...new Set(songInfo.altAnimeNamesAnswers)].sort(
          (a, b) => a.localeCompare(b)
        )
      }
    };
  }
  function sendReveal(songInfo) {
    const revealed2 = revealedSong(songInfo);
    if (!revealed2) return;
    fetch(`${VIDEO_CACHE_ORIGIN}/song`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(revealed2)
    }).catch(() => {
    });
  }
  async function setup() {
    createReasonLabel();
    addListener("answer results", ({ songInfo }) => {
      if (isActive()) sendReveal(songInfo);
    });
    const originalNextVideoInfo = quizVideoController.nextVideoInfo;
    quizVideoController.nextVideoInfo = function(songInfo, ...rest) {
      const target = isActive() ? songTarget(songInfo) : null;
      if (target) void startCheck(target.fileId);
      return originalNextVideoInfo.call(this, songInfo, ...rest);
    };
    const originalLoadNextVideo = quizVideoController.loadNextVideo;
    quizVideoController.loadNextVideo = function() {
      const next = this._nextVideoInfo;
      if (next?.startTime != void 0) return originalLoadNextVideo.call(this);
      const target = isActive() ? songTarget(next?.songInfo) : null;
      const check = target && checks.get(target.fileId);
      if (!check) return originalLoadNextVideo.call(this);
      void check.then(() => originalLoadNextVideo.call(this));
    };
    const originalChangeToNextPlayer = quizVideoController.changeToNextPlayer;
    quizVideoController.changeToNextPlayer = function() {
      originalChangeToNextPlayer.call(this);
      revealed = false;
      showReason();
    };
    const originalReplayVideo = quizVideoController.replayVideo;
    quizVideoController.replayVideo = function() {
      originalReplayVideo.call(this);
      revealed = true;
      showReason();
    };
    const proto = MoeVideoPlayer.prototype;
    const originalGetNextVideoId = proto.getNextVideoId;
    proto.getNextVideoId = function() {
      const url = pickVideo(this);
      if (this === quizVideoController.getCurrentPlayer()) showReason();
      return url;
    };
    function pickVideo(player) {
      mp3Reasons.set(player, null);
      if (!isActive()) return originalGetNextVideoId.call(player);
      const target = player.encrypted ? null : cacheTarget(player.videoMap, player.hostOrder);
      if (target && answers.get(target.fileId) === "cached") {
        player.host = target.hostKey;
        player.resolution = target.resolution;
        return videoCacheUrl(target.fileId);
      }
      const mp3Host = player.hostOrder.find(
        (hostKey) => player.videoMap[hostKey]?.[MP3_RESOLUTION] !== void 0
      );
      if (mp3Host === void 0) return originalGetNextVideoId.call(player);
      player.host = mp3Host;
      player.resolution = MP3_RESOLUTION;
      mp3Reasons.set(player, mp3Reason(player));
      return videoResolver.formatUrl(
        player.videoMap[mp3Host][MP3_RESOLUTION],
        player.encrypted
      );
    }
    const originalHandleError = proto.handleError;
    proto.handleError = function() {
      if (!this.currentVideoUrl?.startsWith(VIDEO_CACHE_ORIGIN)) {
        return originalHandleError.call(this);
      }
      const target = cacheTarget(this.videoMap, this.hostOrder);
      if (target) answers.set(target.fileId, "failed");
      console.warn("[videoCache] Local file failed, playing the mp3");
      this.startLoading();
    };
    registerCommand(
      "videocache",
      () => ({
        shortHelp: "Turn the local video cache on or off",
        longHelp: `Usage: /videocache [on|off]</br>On: songs in the local cache play the video from your disk, and other songs play the mp3. Off: AMQ plays songs as usual. The change starts with the next song. When the quality setting is mp3, the cache is paused.</br>Current value: ${statusText()}`
      }),
      (args) => {
        const value = args.trim().toLowerCase();
        if (value === "on" || value === "off") {
          setDisabled(value === "off");
        } else if (value) {
          gameChat.systemMessage("Usage: /videocache [on|off]");
          return;
        }
        gameChat.systemMessage(`Video cache: ${statusText()}`);
      }
    );
  }

  const __vite_glob_0_24 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    default: setup
  }, Symbol.toStringTag, { value: 'Module' }));

  const POLL_INTERVAL_MS = 200;
  function poll(isReady, timeoutMs) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        let ready = false;
        try {
          ready = isReady();
        } catch {
          ready = false;
        }
        if (ready) return resolve();
        if (Date.now() > deadline) {
          return reject(new Error("[amq] timed out waiting for AMQ to load"));
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      };
      tick();
    });
  }
  function ensureLoad(timeoutMs = 6e4) {
    return poll(
      () => typeof Listener !== "undefined" && typeof socket !== "undefined" && socket._socket !== void 0 && typeof viewChanger !== "undefined" && viewChanger.__controllers !== void 0 && typeof roomBrowser !== "undefined",
      timeoutMs
    );
  }

  const scripts = /* #__PURE__ */ Object.assign({"./answerInput.ts": __vite_glob_0_0,"./answerTimes.ts": __vite_glob_0_1,"./antiAfk.ts": __vite_glob_0_2,"./autoHideVideo.ts": __vite_glob_0_3,"./autoSkip.ts": __vite_glob_0_4,"./autoSubmit.ts": __vite_glob_0_5,"./autoVoter.ts": __vite_glob_0_6,"./betterDropdown.ts": __vite_glob_0_7,"./chatTimestamps.ts": __vite_glob_0_8,"./commands.ts": __vite_glob_0_9,"./customCommands.ts": __vite_glob_0_10,"./customCss.ts": __vite_glob_0_11,"./easyExtraInfo.ts": __vite_glob_0_12,"./easySettings.ts": __vite_glob_0_13,"./fixHints.ts": __vite_glob_0_14,"./forceVideoHost.ts": __vite_glob_0_15,"./jamVoteResultAnnouncer.ts": __vite_glob_0_16,"./keyboardShortcuts.ts": __vite_glob_0_17,"./onlineNotifications.ts": __vite_glob_0_18,"./playedSongs.ts": __vite_glob_0_19,"./playerStats.ts": __vite_glob_0_20,"./showExtraSongInfo.ts": __vite_glob_0_21,"./songHistory.ts": __vite_glob_0_22,"./typingSpeed.ts": __vite_glob_0_23,"./videoCache.ts": __vite_glob_0_24

  });
  async function main() {
    if (document.getElementById("loginUsername")) return;
    for (const [file, { beforeLoad }] of Object.entries(scripts)) {
      try {
        beforeLoad?.();
      } catch (error) {
        console.error(`[amq] ${file} failed before load`, error);
      }
    }
    await ensureLoad();
    for (const [file, { default: setup }] of Object.entries(scripts)) {
      setup().catch(
        (error) => console.error(`[amq] ${file} failed to start`, error)
      );
    }
  }
  main().catch((error) => console.error("[amq] Failed to start", error));

})();