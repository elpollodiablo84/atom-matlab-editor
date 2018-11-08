/* global atom DOMParser */
const fs = require('fs')
const path = require('path')
const DOMPurify = require('dompurify')
const { Emitter } = require('atom')

module.exports =
  class MatlabHelpView {
    constructor (state) {
      this.emitter = new Emitter()

      this.element = document.createElement('div')
      this.element.classList.add('matlab-help-main')

      this.toolbar = document.createElement('div')
      this.toolbar.classList.add('matlab-help-toolbar')
      this.element.appendChild(this.toolbar)

      this.view = document.createElement('div')
      this.view.classList.add('matlab-help-view')
      this.element.appendChild(this.view)

      this.loadToolbar()

      this.historyManager = { position: -1, history: [] }

      if (typeof state !== 'undefined') {
        this.loadView(state.htmlPath, state.anchorId)
      } else {
        this.htmlPath = ''
        this.anchorId = ''
      }
    }

    // Create the toolbar
    loadToolbar () {
      var btnB = document.createElement('button')
      btnB.type = 'button'
      btnB.classList.add('matlab-help-btn-back')
      var iconB = document.createElement('i')
      iconB.classList.add('icon-chevron-left')
      btnB.appendChild(iconB)

      var btnF = document.createElement('button')
      btnF.type = 'button'
      btnF.classList.add('matlab-help-btn-forward')
      var iconF = document.createElement('i')
      iconF.classList.add('icon-chevron-right')
      btnF.appendChild(iconF)

      this.toolbar.appendChild(btnB)
      this.toolbar.appendChild(btnF)

      btnB.addEventListener('click', event => {
        var position = this.historyManager.position
        var history = this.historyManager.history

        if (position - 1 >= 0) {
          this.historyManager.position = position - 1
          this.loadView(history[position - 1].htmlPath, history[position - 1].anchorId, false)
        }
      })

      btnF.addEventListener('click', event => {
        var position = this.historyManager.position
        var history = this.historyManager.history

        if (position + 1 <= history.length - 1) {
          this.historyManager.position = position + 1
          this.loadView(history[position + 1].htmlPath, history[position + 1].anchorId, false)
        }
      })
    }

    updateToolbar () {
      var btnB = this.toolbar.getElementsByClassName('matlab-help-btn-back')[0]
      var btnF = this.toolbar.getElementsByClassName('matlab-help-btn-forward')[0]

      var history = this.historyManager.history
      var position = this.historyManager.position

      btnB.disabled = false
      if (position === 0) btnB.disabled = true

      btnF.disabled = false
      if (position === history.length - 1) btnF.disabled = true
    }

    // Load the html page 'htmlPath' into the view and scroll to the anchor point 'anchorId'
    loadView (htmlPath, anchorId, updateHistory = true) {
      if (htmlPath) {
        fs.readFile(htmlPath, (err, html) => {
          if (err) {
            console.log(err)
          } else {
            var parser = new DOMParser()
            var docFile = parser.parseFromString(html.toString(), 'text/html')
            var section = docFile.getElementsByTagName('section')[0]

            // Remove useless elements
            var uselessElements = section.querySelectorAll(
              '.btn, .pull-right, span[class^=icon], ' +
              'a[class=expandAllLink], p[class=syntax_example], ' +
              'div[class=switch], div[class|=clear], ' +
              'img[class=baseline2]'
            )
            for (let i = uselessElements.length - 1; i >= 0; i--) {
              uselessElements[i].parentNode.removeChild(uselessElements[i])
            }

            // Get all elements that need to be modified
            var styledItems = section.querySelectorAll('span[style]')
            var links = section.querySelectorAll('a[href]')
            var divPanels = section.getElementsByClassName('panel-default')
            var divTab = section.querySelectorAll('div[role^=tab]')
            var mathList = section.getElementsByTagName('math')
            var imgList = section.getElementsByTagName('img')

            // Change some UI visualization
            for (let i = 0; i < divTab.length; i++) {
              divTab[i].removeAttribute('class')
            }
            for (let i = 0; i < styledItems.length; i++) {
              styledItems[i].removeAttribute('style')
            }
            for (let i = 0; i < divPanels.length; i++) {
              divPanels[i].classList.remove('panel')
            }

            // Links management
            var page, anchor
            for (let i = 0; i < links.length; i++) {
              [page, anchor] = links[i].getAttribute('href').split('#')
              if (page) {
                links[i].href = path.join(path.dirname(htmlPath), page) + '#' + anchor
              } else {
                links[i].href = htmlPath + '#' + anchor
              }

              links[i].addEventListener('click', event => {
                var [page, anchor] = event.currentTarget.getAttribute('href').split('#')
                this.loadView(page, anchor)
              })
            }

            // Transform math elements in images
            var altimg
            var newImg
            for (let i = mathList.length - 1; i >= 0; i--) {
              altimg = mathList[i].getAttribute('altimg') || ''
              if (altimg) {
                newImg = document.createElement('img')
                newImg.src = altimg
                if (atom.config.get('atom-matlab-editor.darkTheme')) {
                  newImg.classList.add('math_dark')
                } else {
                  newImg.classList.add('math_light')
                }
                mathList[i].parentNode.replaceChild(newImg, mathList[i])
              } else {
                mathList[i].parentNode.removeChild(mathList[i])
              }
            }

            // Correct images source
            var filename
            for (let i = 0; i < imgList.length; i++) {
              filename = imgList[i].getAttribute('src')
              imgList[i].src = path.join(path.dirname(htmlPath), filename)
            }

            // Finally set the view's innerHTML
            section.outerHTML = DOMPurify().sanitize(section.outerHTML)

            var oldSection = this.view.getElementsByTagName('section')
            if (oldSection.length > 0) this.view.removeChild(oldSection[0])
            this.view.appendChild(section)

            // Scroll to the anchor point 'anchorId'
            var offset = 0
            if (typeof anchorId !== 'undefined' && anchorId.length > 0) {
              var anchorPoint = section.querySelectorAll('#' + anchorId)[0]
              if (anchorPoint) offset = anchorPoint.offsetTop
            }
            this.view.scrollTop = offset

            this.htmlPath = htmlPath
            this.emitter.emit('did-change-title')

            if (updateHistory) {
              this.historyManager.history.splice(this.historyManager.position + 1)
              this.historyManager.history.push({ htmlPath: htmlPath, anchorId: anchorId })
              this.historyManager.position = this.historyManager.position + 1
            }
            this.updateToolbar()
          }
        })
      }
    }

    onDidChangeTitle (callback) {
      return this.emitter.on('did-change-title', callback)
    }

    getHelpPath () {
      return path.join(atom.config.get('atom-matlab-editor.matlabRootPath'), 'help', 'matlab', 'ref')
    }

    getTitle () {
      var title = 'Matlab Help'
      if (this.view.querySelectorAll('[itemprop^=title]').length > 0) {
        title = title + ': ' + this.view.querySelectorAll('[itemprop^=title]')[0].innerText
      }

      return title
    }

    getDefaultLocation () {
      return 'right'
    }

    getAllowedLocations () {
      return ['left', 'right', 'bottom']
    }

    getURI () {
      return 'atom-matlab-editor://matlab-help'
    }

    getPreferredWidth () {
      return 656
    }

    serialize () {
      return {
        deserializer: 'atom-matlab-editor/MatlabHelpView',
        htmlPath: this.htmlPath,
        anchorId: this.anchorId
      }
    }

    destroy () {
      this.element.remove()
    }

    getElement () {
      return this.element
    }
  }
