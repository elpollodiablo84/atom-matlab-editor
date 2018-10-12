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
        this.loadView(state.htmlPath)
      } else {
        this.htmlPath = ''
      }
    }

    loadView (htmlPath) {
      if (htmlPath) {
        fs.readFile(htmlPath, (err, html) => {
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
            var seeAlsoLinks = section.querySelectorAll('span[itemprop=seealso]')
            var contentLinks = section.querySelectorAll('div[class=ref_sect] div[itemprop=content]')
            var relatedLinks = section.querySelectorAll('h2 + ul')
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
              seeAlsoLinks[i].firstChild.addEventListener('click', event => {
                var link = event.target

                if (link.tagName === 'CODE') {
                  this.loadView(path.join(path.dirname(htmlPath), event.target.parentNode.parentNode.getAttribute('href')))
                } else if (link.tagName === 'SPAN') {
                  this.loadView(path.join(path.dirname(htmlPath), event.target.parentNode.getAttribute('href')))
                }
              })
            }

            var liArray
            for (let i = 0; i < contentLinks.length; i++) {
              liArray = contentLinks[i].getElementsByTagName('li')

              for (let j = 0; j < liArray.length; j++) {
                if (!liArray[j].firstChild.getAttribute('target')) {
                  liArray[j].firstChild.addEventListener('click', event => {
                    this.loadView(path.join(path.dirname(htmlPath), event.target.getAttribute('href')))
                  })
                }
              }
            }

            for (let i = 0; i < relatedLinks.length; i++) {
              liArray = relatedLinks[i].getElementsByTagName('li')

              for (let j = 0; j < liArray.length; j++) {
                liArray[j].firstChild.addEventListener('click', event => {
                  this.loadView(path.join(path.dirname(htmlPath), event.target.getAttribute('href')))
                })
              }
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
            this.element.scrollTop = 0
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
      return 600
    }

    serialize () {
      return {
        deserializer: 'atom-matlab-editor/MatlabHelpView',
        htmlPath: this.htmlPath
      }
    }

    destroy () {
      this.element.remove()
    }

    getElement () {
      return this.element
    }
  }
