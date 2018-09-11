module.exports =
  class MatlabHelpView {
    constructor (state) {
      this.element = document.createElement('div')
      this.element.classList.add('matlab-help')

      this.webview = document.createElement('webview')
      this.webview.classList.add('webview')
      this.element.appendChild(this.webview)
    }

    setWebviewSrc (keyword) {
      if (keyword) {
        this.webview.src = 'file://C:\\Program Files\\MATLAB\\R2017a\\help\\matlab\\ref\\' + keyword + '.html'
        // this.webview.src = 'http://mathworks.com/help/releases/R2017a/matlab/ref/' + keyword + '.html'
      }
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
        deserializer: 'atom-matlab-editor/MatlabHelpView'
      }
    }

    destroy () {
      this.element.remove()
    }

    getElement () {
      return this.element
    }
  }
