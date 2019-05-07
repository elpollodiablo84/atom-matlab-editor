module.exports =
  class StatusBarElement {
    constructor (text) {
      this.element = document.createElement('div')
      this.element.classList.add('inline-block')

      this.icon = document.createElement('span')
      this.icon.classList.add('icon', 'matlab-logo-icon')

      this.cdpath = document.createElement('span')
      this.cdpath.classList.add('atom-matlab-editor-cd')

      this.element.appendChild(this.icon)
      this.element.appendChild(this.cdpath)
      this.updateText(text)
    }

    updateText (text) {
      this.cdpath.textContent = text
    }

    updateStatus (status) {
      if (status) {
        this.cdpath.style.display = 'inline-block'
        this.icon.classList.remove('matlab-not-found')
      } else {
        this.cdpath.style.display = 'none'
        this.icon.classList.add('matlab-not-found')
      }
    }

    destroy () {
      this.element.remove()
    }

    getElement () {
      return this.element
    }
  }
