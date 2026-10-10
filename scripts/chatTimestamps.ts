export default async function setup() {
  const cb: MutationCallback = (mutationsList) =>
    mutationsList.forEach((mutation) => {
      if (mutation.type !== 'childList') return
      for (const node of mutation.addedNodes) {
        const timestampEl = document.createElement('span')
        const time = new Date()
        const timeStr = [time.getHours(), time.getMinutes(), time.getSeconds()]
          .map((n) => n.toString().padStart(2, '0'))
          .join(':')
        timestampEl.innerText = `[${timeStr}]`
        timestampEl.style.marginRight = '0.5rem'
        if (node instanceof HTMLElement) node.prepend(timestampEl)
      }
    })

  const observer = new MutationObserver(cb)
  const target = document.querySelector('#gcMessageContainer')
  if (!target) {
    throw new Error('Could not find target')
  }
  observer.observe(target, { childList: true })
}
