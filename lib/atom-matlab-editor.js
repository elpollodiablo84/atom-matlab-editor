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
    lastOutput: '',

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
      var extensions = ['.m', '.mlx', '.mdl', '.slx', '.fig', '.mat', '.prj']
      MatlabEditor.subscriptions = new CompositeDisposable()

      MatlabEditor.subscriptions.add(
        atom.contextMenu.add({
          '.tab-bar .tab': [
            { type: 'separator' },
            {
              label: '',
              command: 'atom-matlab-editor:change-folder',
              created: function (event) {
                var filePath = path.dirname(event.target.dataset.path)
                if (filePath.length > 18) {
                  filePath = path.parse(filePath).root + '...' + filePath.slice(filePath.length - 15, filePath.length)
                }
                this.label = 'Change Matlab Folder to ' + filePath
              },
              shouldDisplay: function (event) {
                var filePath = event.target.dataset.path
                if (typeof filePath !== 'undefined') {
                  return extensions.includes(path.extname(filePath))
                } else {
                  return false
                }
              }
            },
            { type: 'separator' }
          ],
          '.tree-view .file': [
            { type: 'separator' },
            {
              label: 'Open in Matlab',
              command: 'atom-matlab-editor:open-in-matlab',
              shouldDisplay: function (event) {
                var filePath = event.target.dataset.path
                if (typeof filePath !== 'undefined') {
                  return extensions.includes(path.extname(filePath))
                } else {
                  return false
                }
              }
            },
            { type: 'separator' }
          ]
        }),

        atom.workspace.addOpener(uri => {
          if (uri === 'atom-matlab-editor://matlab-help') {
            return new MatlabHelpView()
          }
        }),

        atom.commands.add('atom-text-editor', {
          'atom-matlab-editor:run-file': () => MatlabEditor.runFile(),
          'atom-matlab-editor:run-section': () => MatlabEditor.runSection(),
          'atom-matlab-editor:run-selection': () => MatlabEditor.runSelection(),
          'atom-matlab-editor:open-selection': () => MatlabEditor.openSelection(),
          'atom-matlab-editor:get-help': () => MatlabEditor.getHelp()
        }),

        atom.commands.add('.tab-bar', {
          'atom-matlab-editor:change-folder': () => MatlabEditor.changeFolder()
        }),

        atom.commands.add('.tree-view', {
          'atom-matlab-editor:open-in-matlab': () => MatlabEditor.openInMatlab()
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
        MatlabEditor.executeText(filePath, '0')
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
        MatlabEditor.executeText(MatlabEditor.tmpFile.name, '1')
      }
    },

    // Run the current selection in Matlab
    runSelection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        // Get the selected text
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
          MatlabEditor.executeText(MatlabEditor.tmpFile.name, '2')
        }
      }
    },

    // Open the first script/function in the path with the same name as the selected text
    openSelection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        // Get the selected text
        var selections = editor.getSelections()

        if (selections.length !== 0) {
          // Considering only the first selected token
          var selectionText = selections[0].getText()

          // runCommand callback
          var clbk = (code) => {
            if (code === 0 && MatlabEditor.lastOutput.slice(0, 1) !== '\'') {
              atom.workspace.open(MatlabEditor.lastOutput.trim())
            }
          }

          // Execute the MATLAB command 'which' on the selected text
          MatlabEditor.runCommand('which(\'' + selectionText + '.m\')', clbk)
        }
      }
    },

    // Execute the text/run the file 'inputText' in Matlab
    executeText (inputText, type) {
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

      // Debug
      // var stdout = (str) => console.log(str)
      // MatlabEditor.process = new BufferedProcess({ command, args, options, stdout, stderr, exit })
    },

    // Run the command 'cmd', save the output and execute the callback 'clbk' when it's done
    runCommand (cmd, clbk) {
      var arch = MatlabEditor.getArch()
      var pathToMatlab = MatlabEditor.getMatlabPath()
      var pathToLib = path.join(atom.config.getUserConfigPath().replace('config.cson', ''), 'packages', 'atom-matlab-editor', 'lib', 'java')
      var matlabJava = path.join(pathToMatlab, 'sys', 'java', 'jre', arch, 'jre', 'bin', 'java')

      var command = '"' + matlabJava + '" -cp .;"' + path.join(pathToMatlab, 'extern', 'engines', 'java', 'jar', 'engine.jar') + '" javaMatlabConnect'
      var args = [cmd, -1]
      var options = {
        cwd: pathToLib,
        shell: true
      }
      var stdout = (out) => { MatlabEditor.lastOutput = out }
      var exit = clbk

      MatlabEditor.process = new BufferedProcess({ command, args, options, stdout, exit })
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

    // Visualize the Matlab help in a panel
    getHelp () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        var keyword = atom.workspace.getActiveTextEditor().getSelectedText()
        var htmlPath = path.join(MatlabHelpView.prototype.getHelpPath(), keyword + '.html')
        var docPath = path.join(MatlabHelpView.prototype.getHelpPath(), '..', 'index.html')

        if (!keyword) {
          atom.workspace.open('atom-matlab-editor://matlab-help').then((view) => {
            if (view instanceof MatlabHelpView) view.loadView(docPath, '')
          })
        } else if (fs.existsSync(htmlPath)) {
          atom.workspace.open('atom-matlab-editor://matlab-help').then((view) => {
            if (view instanceof MatlabHelpView) view.loadView(htmlPath, '')
          })
        }
      }
    },

    // Change the Matlab folder to the selected file path
    changeFolder () {
      var tab = document.querySelector('.texteditor.tab.right-clicked')
      var dirPath = path.dirname(tab.querySelector('.title').dataset.path)

      MatlabEditor.runCommand('cd(\'' + dirPath + '\')', null)
    },

    // Open file in Matlab
    openInMatlab () {
      var filePath = document.querySelector('.tree-view').querySelector('.file.selected').querySelector('.name').dataset.path
      var fileExt = path.extname(filePath)

      if (fileExt === '.mat') {
        MatlabEditor.runCommand('load(\'' + filePath + '\')', null)
      } else {
        MatlabEditor.runCommand('open(\'' + filePath + '\')', null)
      }
    },

    // Deserialize method for the Matlab help view
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
