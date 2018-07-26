/* global atom */
const {CompositeDisposable, BufferedProcess} = require('atom')

var MatlabEditor =
  module.exports = {
    subscriptions: null,
    process: null,
    provider: null,
    error: {notification: {stack: '', detail: undefined, dismissable: true}, type: undefined},

    activate (state) {
      MatlabEditor.subscriptions = new CompositeDisposable()

      MatlabEditor.subscriptions.add(atom.commands.add('atom-workspace', {
        'atom-matlab-editor:run-file': () => MatlabEditor.runFile()
      }))
    },

    deactivate () {
      MatlabEditor.subscriptions.dispose()
    },

    consumeSignal (registry) {
      MatlabEditor.provider = registry.create()
      MatlabEditor.subscriptions.add(MatlabEditor.provider)
    },

    // Run the current file in Matlab
    runFile () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        var filePath = editor.getPath()
        MatlabEditor.provider.add('Running:' + filePath)
        MatlabEditor.runText(filePath, '0')
      }
    },

    // Run the string 'text' in Matlab
    runText (text, type) {
      var arch = MatlabEditor.getArch()
      var pathToMatlab = MatlabEditor.getMatlabPath()
      var pathToLib = atom.config.getUserConfigPath().replace('config.cson', '') + 'packages\\atom-matlab-editor\\lib\\java'
      var matlabJava = pathToMatlab + '\\sys\\java\\jre\\' + arch + '\\jre\\bin\\java'

      var command = '"' + matlabJava + '" -cp .;"' + pathToMatlab + '\\extern\\engines\\java\\jar\\engine.jar" javaMatlabConnect'
      var args = [text, type]
      var options = {
        cwd: pathToLib,
        shell: true
      }
      var stderr = MatlabEditor.collectAllErrors
      var exit = MatlabEditor.setErrorNotification

      MatlabEditor.process = new BufferedProcess({command, args, options, stderr, exit})
    },

    // Collect and parse all possible errors encountered during the script execution
    collectAllErrors (error) {
      var parsedError = error.split('\n')

      for (let i = 0; i < parsedError.length; i++) {
        var errorText = parsedError[i].split(': ')

        if (errorText.length > 1) {
          if (errorText[1].startsWith('Unable to connect')) {
            // Matlab instance not found
            MatlabEditor.error.notification.detail = 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.'
            MatlabEditor.error.type = 2
          } else if (parsedError[i].startsWith('com.mathworks.mvm.exec')) {
            // Matlab error
            if (errorText[1] === 'Error') {
              // Syntax error
              let source = parsedError[i].split(/[<>]+/)
              let type = parsedError[i + 1].split('>')[1]
              let path = source[1].split('\'')[1]
              let line = source[1].split(/[,)]+/)[1]
              let col = source[1].split(/[,)]+/)[2]
              MatlabEditor.error.notification.detail = type + '\n(File: "' + path + '", Line: ' + line + ', Column: ' + col + ')'
              MatlabEditor.error.type = 1
            } else {
              // Runtime error
              MatlabEditor.error.notification.detail = errorText[1]
              MatlabEditor.error.type = 0
            }
          }
        }

        // Error stacktrace in case of Matlab runtine errors
        if (MatlabEditor.error.type === 0 && parsedError[i].startsWith('Error in')) {
          let stackCall = parsedError[i].split('==> ')[1]
          let path = stackCall.split('>')[0]
          let file = stackCall.split('>')[1].split(' at ')[0]
          let line = stackCall.split('>')[1].split(' at ')[1]
          MatlabEditor.error.notification.stack += 'Error in ' + file + ' (' + path + ':' + line + ')' + '\n'
        }
      }

      console.log('ERR: ' + error)
    },

    // Visualize a notification in case of errors during the script execution
    setErrorNotification (code) {
      // All possible message errors (in order of MatlabEditor.error.type)
      var errorTitle = ['Matlab Runtime Exception', 'Matlab Syntax Error', 'Unavailable Matlab Session']

      // Create notification
      if (code === 1 && typeof MatlabEditor.error.notification.detail !== 'undefined') {
        atom.notifications.addError(errorTitle[MatlabEditor.error.type], MatlabEditor.error.notification)
      }

      // Reset the MatlabEditor.error
      MatlabEditor.error = {notification: {stack: '', detail: undefined, dismissable: true}, type: undefined}

      // Stop the busy-signal provider
      MatlabEditor.provider.clear()
    },

    // Get the PC architecture
    getArch () {
      return 'win64'
    },

    // Get the main Matlab path
    getMatlabPath () {
      return 'C:\\Program Files\\MATLAB\\R2017a'
    }

  }
