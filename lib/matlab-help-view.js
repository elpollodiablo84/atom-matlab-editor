/* global atom DOMParser */
const fs = require('fs')
const path = require('path')
const DOMPurify = require('dompurify')

module.exports =
  class MatlabHelpView {
    constructor (state) {
      this.element = document.createElement('div')
      this.element.classList.add('matlab-help-view')
      if (typeof state !== 'undefined') {
        this.loadView(state.htmlPath, state.anchorId)
      } else {
        this.htmlPath = ''
        this.anchorId = ''
      }
    }

    loadView (htmlPath, anchorId) {
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

            if (this.element.firstChild) this.element.removeChild(this.element.firstChild)
            this.element.appendChild(section)

            var offset = 0
            if (typeof anchorId !== 'undefined' && anchorId.length > 0) {
              var anchorPoint = section.querySelectorAll('#' + anchorId)[0]
              if (anchorPoint) offset = anchorPoint.offsetTop
            }
            this.element.scrollTop = offset

            this.htmlPath = htmlPath
          }
        })
      }
    }

    getHelpPath () {
      return path.join(atom.config.get('atom-matlab-editor.matlabRootPath'), 'help', 'matlab', 'ref')
    }

    getTitle () {
      return 'Matlab Help'
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
