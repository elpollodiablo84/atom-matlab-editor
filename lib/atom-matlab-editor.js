/* global atom */
const MatlabHelpView = require('./matlab-help-view')
const { CompositeDisposable, Disposable, BufferedProcess } = require('atom')
const tmp = require('tmp')
const fs = require('fs')
const path = require('path')

var MatlabEditor =
  module.exports = {
    subscriptions: null,
    process: null,
    provider: null,
    tmpFile: null,
    error: { notification: { stack: '', detail: undefined, dismissable: true }, type: undefined },

    config: {
      matlabRootPath: {
        type: 'string',
        title: 'MATLAB root path',
        description: 'Specify the MATLAB root path: type [`matlabroot`](https://mathworks.com/help/matlab/ref/matlabroot.html) in your MATLAB command window',
        default: '',
        order: 1
      },
      computerArch: {
        type: 'string',
        title: 'Computer architecture',
        description: 'Specify the computer architecture: type [`computer(\'arch\')`](https://mathworks.com/help/matlab/ref/computer.html) in your MATLAB command window',
        default: '',
        order: 2
      },
      darkTheme: {
        type: 'boolean',
        title: 'Dark theme',
        description: 'Select if you are using a dark UI theme',
        default: 'true',
        order: 3
      }
    },

    activate (state) {
      MatlabEditor.subscriptions = new CompositeDisposable()

      MatlabEditor.subscriptions.add(
        atom.workspace.addOpener(uri => {
          if (uri === 'atom-matlab-editor://matlab-help') {
            return new MatlabHelpView()
          }
        }),

        atom.commands.add('atom-text-editor', {
          'atom-matlab-editor:run-file': () => MatlabEditor.runFile(),
          'atom-matlab-editor:run-section': () => MatlabEditor.runSection(),
          'atom-matlab-editor:run-selection': () => MatlabEditor.runSelection(),
          'atom-matlab-editor:get-help': () => MatlabEditor.getHelp()
        }),

        new Disposable(() => {
          atom.workspace.getPaneItems().forEach(item => {
            if (item instanceof MatlabHelpView) {
              item.destroy()
            }
          })
        })
      )
    },

    deactivate () {
      MatlabEditor.subscriptions.dispose()
    },

    consumeSignal (registry) {
      MatlabEditor.provider = registry.create()
      MatlabEditor.subscriptions.add(MatlabEditor.provider)
    },

    consumeBounds (getSectionBounds) {
      MatlabEditor.getSectionBounds = getSectionBounds
      return new Disposable(() => {
        MatlabEditor.getSectionBounds = null
      })
    },

    // Run the current file in Matlab
    runFile () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        var fileName = editor.buffer.file.getBaseName()
        var filePath = '"' + editor.getPath() + '"'
        var currentDate = MatlabEditor.getCurrentDate()

        MatlabEditor.provider.add(currentDate + ' Running ' + fileName)
        MatlabEditor.runText(filePath, '0')
      }
    },

    // Run the current section in Matlab
    runSection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        // Select the text in the corresponding section
        var line = editor.getCursorBufferPosition()
        var sectionBounds = MatlabEditor.getSectionBounds(editor, line.row)
        var sectionText = editor.getTextInBufferRange([[sectionBounds[0], 0], [sectionBounds[1], Infinity]])

        // Create a temporary file
        MatlabEditor.tmpFile = tmp.fileSync({ prefix: 'AME_', postfix: '.m' })
        fs.writeFile(MatlabEditor.tmpFile.name, sectionText, (err) => {
          if (err) {
            console.log('TMP: ' + err.message)
          }
        })

        // Execute the file in Matlab
        var fileName = editor.buffer.file.getBaseName()
        var currentDate = MatlabEditor.getCurrentDate()

        MatlabEditor.provider.add(currentDate + ' Running section of ' + fileName)
        MatlabEditor.runText(MatlabEditor.tmpFile.name, '1')
      }
    },

    // Run the current selection in Matlab
    runSelection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        // Select the selected text
        var selectionText = ''
        var selections = editor.getSelections()

        if (selections.length !== 0) {
          for (let i = 0; i < selections.length; i++) {
            selectionText = selectionText + selections[i].getText()
          }

          // Create a temporary file
          MatlabEditor.tmpFile = tmp.fileSync({ prefix: 'AME_', postfix: '.m' })
          fs.writeFile(MatlabEditor.tmpFile.name, selectionText, (err) => {
            if (err) {
              console.log('TMP: ' + err.message)
            }
          })

          // Execute the file in Matlab
          var currentDate = MatlabEditor.getCurrentDate()

          MatlabEditor.provider.add(currentDate + ' Running selection')
          MatlabEditor.runText(MatlabEditor.tmpFile.name, '1')
        }
      }
    },

    // Run the command/file 'inputText' in Matlab
    runText (inputText, type) {
      var arch = MatlabEditor.getArch()
      var pathToMatlab = MatlabEditor.getMatlabPath()
      var pathToLib = path.join(atom.config.getUserConfigPath().replace('config.cson', ''), 'packages', 'atom-matlab-editor', 'lib', 'java')
      var matlabJava = path.join(pathToMatlab, 'sys', 'java', 'jre', arch, 'jre', 'bin', 'java')

      var command = '"' + matlabJava + '" -cp .;"' + path.join(pathToMatlab, 'extern', 'engines', 'java', 'jar', 'engine.jar') + '" javaMatlabConnect'
      var args = [inputText, type]
      var options = {
        cwd: pathToLib,
        shell: true
      }
      var stderr = MatlabEditor.collectAllErrors
      var exit = MatlabEditor.finalizeProcess

      MatlabEditor.process = new BufferedProcess({ command, args, options, stderr, exit })
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

    // Visualize a notification in case of errors during the script execution and delete the temporary file (if present)
    finalizeProcess (code) {
      // All possible message errors (in order of MatlabEditor.error.type)
      var errorTitle = ['Matlab Runtime Exception', 'Matlab Syntax Error', 'Unavailable Matlab Session']

      // Create notification
      if (code === 1 && typeof MatlabEditor.error.notification.detail !== 'undefined') {
        atom.notifications.addError(errorTitle[MatlabEditor.error.type], MatlabEditor.error.notification)
      }

      // Reset the MatlabEditor.error
      MatlabEditor.error = { notification: { stack: '', detail: undefined, dismissable: true }, type: undefined }

      // Stop the busy-signal provider
      MatlabEditor.provider.clear()

      // Delete the temporary file
      if (MatlabEditor.tmpFile !== null) {
        MatlabEditor.tmpFile.removeCallback()
        MatlabEditor.tmpFile = null
      }
    },

    getHelp () {
      var keyword = atom.workspace.getActiveTextEditor().getSelectedText()
      var htmlPath = path.join(MatlabHelpView.prototype.getHelpPath(), keyword + '.html')

      if (fs.existsSync(htmlPath) && keyword) {
        atom.workspace.open('atom-matlab-editor://matlab-help').then((view) => {
          if (view instanceof MatlabHelpView) view.loadView(htmlPath)
        })
      }
    },

    deserializeMatlabHelpView (state) {
      return new MatlabHelpView(state)
    },

    // Get the PC architecture
    getArch () {
      return atom.config.get('atom-matlab-editor.computerArch')
    },

    // Get the main Matlab path
    getMatlabPath () {
      return atom.config.get('atom-matlab-editor.matlabRootPath')
    },

    // Get the current date
    getCurrentDate () {
      var dateTime = new Date()
      return '[' + dateTime.getFullYear() + '/' +
                  (dateTime.getMonth() + 1) + '/' +
                   dateTime.getDate() + ' ' +
                   dateTime.getHours() + ':' +
                   dateTime.getMinutes() + ':' +
                   dateTime.getSeconds() + ']'
    }

  }
