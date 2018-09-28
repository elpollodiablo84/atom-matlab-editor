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
        this.loadView(state.keyword)
      } else {
        this.keyword = ''
      }
    }

    loadView (keyword) {
      if (keyword) {
        fs.readFile(path.join(this.getHelpPath(), keyword + '.html'), (err, html) => {
          if (!err) {
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
            var internalLinks = section.querySelectorAll('a[class=intrnllnk]')
            var seeAlsoLinks = section.querySelectorAll('a[itemprop=url]')
            var divPanels = section.getElementsByClassName('panel-default')
            var panelTitles = section.getElementsByClassName('panel-title')
            var mathList = section.getElementsByTagName('math')
            var imgList = section.getElementsByTagName('img')

            // Change some UI visualization
            var parentElem
            for (let i = 0; i < panelTitles.length; i++) {
              parentElem = panelTitles[i].parentNode
              parentElem.parentNode.replaceChild(panelTitles[i], parentElem)
            }
            for (let i = 0; i < styledItems.length; i++) {
              styledItems[i].removeAttribute('style')
            }
            for (let i = 0; i < divPanels.length; i++) {
              divPanels[i].classList.remove('panel')
            }

            // Correct internal links
            for (let i = 0; i < internalLinks.length; i++) {
              // TBD
            }

            // Correct "See Also" links
            for (let i = 0; i < seeAlsoLinks.length; i++) {
              seeAlsoLinks[i].addEventListener('click', event => {
                this.loadView(event.target.innerText)
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
              imgList[i].src = path.join(this.getHelpPath(), filename)
            }

            // Finally set the view's innerHTML
            section.outerHTML = DOMPurify().sanitize(section.outerHTML)

            if (this.element.firstChild) this.element.removeChild(this.element.firstChild)
            this.element.appendChild(section)
            this.element.scrollTop = 0
            this.keyword = keyword
          }
        })
      }
    }

    getHelpPath () {
      return path.join(atom.config.get('atom-matlab-editor.matlabRootPath'), 'help', 'matlab', 'ref')
    }

    getTitle () {
      var title = 'Matlab Help'
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

    serialize () {
      return {
        deserializer: 'atom-matlab-editor/MatlabHelpView',
        keyword: this.keyword
      }
    }

    destroy () {
      this.element.remove()
    }

    getElement () {
      return this.element
    }
  }
