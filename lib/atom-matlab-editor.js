/* global atom DOMParser */
const MatlabHelpView = require('./matlab-help-view')
const StatusBarElement = require('./statusbar-element')
const { CompositeDisposable, Disposable, BufferedProcess, watchPath } = require('atom')
const tmp = require('tmp')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')

var MatlabEditor =
  module.exports = {
    subscriptions: null,
    process: null,
    provider: null,
    tmpFileName: null,
    error: { notification: { stack: '', detail: undefined, dismissable: true }, type: undefined },
    lastOutput: '',
    statusBarElement: new StatusBarElement(),
    sessionStatus: null,

    // Configuration parameters
    config: {
      computerArch: {
        type: 'string',
        title: 'Computer architecture',
        description: 'Specify the computer architecture: type [`computer(\'arch\')`](https://mathworks.com/help/matlab/ref/computer.html) in your MATLAB command window',
        default: '',
        order: 1
      },
      matlabRootPath: {
        type: 'string',
        title: 'MATLAB root path',
        description: 'Specify the MATLAB root path: type [`matlabroot`](https://mathworks.com/help/matlab/ref/matlabroot.html) in your MATLAB command window',
        default: '',
        order: 2
      },
      prefDirPath: {
        type: 'string',
        title: 'MATLAB preferences folder',
        description: 'Specify the MATLAB folder containing settings: type [`prefdir`](https://mathworks.com/help/matlab/ref/prefdir.html) in your MATLAB command window',
        default: '',
        order: 3
      },
      tempDirPath: {
        type: 'string',
        title: 'MATLAB temporary folder',
        description: 'Specify the MATLAB temporary folder: type [`tempdir`](https://mathworks.com/help/matlab/ref/tempdir.html) in your MATLAB command window',
        default: '',
        order: 4
      },
      legacyVersion: {
        type: 'boolean',
        title: 'Version < R2020a',
        description: 'Select if you are using a version **strictly** older than R2020a',
        default: 'false',
        order: 5
      },
      darkTheme: {
        type: 'boolean',
        title: 'Dark theme',
        description: 'Select if you are using a dark UI theme',
        default: 'true',
        order: 6
      },
      logToConsole: {
        type: 'boolean',
        title: 'Log in Developer Tools console',
        description: 'For debug only',
        default: 'false',
        order: 7
      }
    },

    activate (state) {
      var extensions = ['.m', '.mlx', '.mdl', '.slx', '.fig', '.mat', '.prj']
      MatlabEditor.subscriptions = new CompositeDisposable()

      MatlabEditor.subscriptions.add(
        // Context Menu customization: tab-bar and tree-view
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
                  return extensions.includes(path.extname(filePath).toLowerCase())
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
                  return extensions.includes(path.extname(filePath).toLowerCase())
                } else {
                  return false
                }
              }
            },
            { type: 'separator' }
          ]
        }),

        // MatlabHelpView: destroyer and URI opener
        atom.workspace.addOpener(uri => {
          if (uri === 'atom-matlab-editor://matlab-help') {
            return new MatlabHelpView()
          }
        }),

        new Disposable(() => {
          atom.workspace.getPaneItems().forEach(item => {
            if (item instanceof MatlabHelpView) {
              item.destroy()
            }
          })
        }),

        // Package's commands
        atom.commands.add('atom-text-editor', {
          'atom-matlab-editor:run-file': () => MatlabEditor.runFile(),
          'atom-matlab-editor:save-run-file': () => MatlabEditor.saveRunFile(),
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

        atom.workspace.observeActiveTextEditor(
          (activeEditor) => {
            if (typeof activeEditor !== 'undefined') {
              var activePath = activeEditor.getPath()
              if (activePath) {
                var isMatlabFile = extensions.includes(path.extname(activeEditor.getPath()).toLowerCase())
                MatlabEditor.statusBarElement.setVisibility(isMatlabFile)
              }
            } else {
              MatlabEditor.statusBarElement.setVisibility(false)
            }
          }
        ),

        // PathWatcher: scan Matlab prefdir and update Matlab Current Folder
        new Disposable(watchPath(MatlabEditor.getMatlabPrefDir(), {}, events => {
          for (const event of events) {
            if (event.action === 'created' && path.basename(event.path) === MatlabEditor.getMatlabSettingsFile()) {
              MatlabEditor.updateCurrentFolderStatusbar()
            }
          }
        })),

        // PathWatcher: scan Matlab tempdir and update the Matlab session status
        new Disposable(watchPath(MatlabEditor.getMatlabTempDir(), {}, events => {
          for (const event of events) {
            if (path.basename(event.path) === 'AtomMatlabEngine') {
              if (event.action === 'created' || event.action === 'modified') {
                MatlabEditor.sessionStatus = true
              } else {
                MatlabEditor.sessionStatus = false
              }
              MatlabEditor.statusBarElement.updateStatus(MatlabEditor.sessionStatus)
            }
          }
        }))
      )

      // Check Matlab sessions status on activation
      MatlabEditor.checkSessionStatus()

      // Update Matlab Current Folder on the statusbar on activation
      MatlabEditor.updateCurrentFolderStatusbar()
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

    consumeStatusBar (statusBar) {
      MatlabEditor.statusBarElement.getElement().addEventListener('click', (event) => MatlabEditor.forceCheckSessionStatus())
      statusBar.addRightTile({ item: MatlabEditor.statusBarElement, priority: 300 })
    },

    // Run the current file in Matlab
    runFile () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        if (MatlabEditor.checkSessionStatus()) {
          var fileName = editor.buffer.file.getBaseName()
          var filePath = '"' + editor.getPath() + '"'
          var currentDate = MatlabEditor.getCurrentDate()

          MatlabEditor.provider.add(currentDate + ' Running ' + fileName)
          MatlabEditor.executeText(filePath, '0')
        } else {
          atom.notifications.addError('Unavailable Matlab Session',
            { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
        }
      }
    },

    // Save and run current file in Matlab
    saveRunFile () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        var savePromise = editor.save()
        savePromise.then((result) => { MatlabEditor.runFile() }, (err) => { console.log(err) })
      }
    },

    // Run the current section in Matlab
    runSection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        if (MatlabEditor.checkSessionStatus()) {
          // Select the text in the corresponding section
          var line = editor.getCursorBufferPosition()
          var sectionBounds = MatlabEditor.getSectionBounds(editor, line.row)
          var sectionText = editor.getTextInBufferRange([[sectionBounds[0], 0], [sectionBounds[1], Infinity]])

          // Create a temporary file
          MatlabEditor.tmpFileName = tmp.tmpNameSync({ prefix: 'AME_', postfix: '.m' })
          MatlabEditor.tmpFileName = MatlabEditor.cleanFileName(MatlabEditor.tmpFileName)
          fs.writeFile(MatlabEditor.tmpFileName, sectionText, (err) => {
            if (err) {
              console.log('[Atom Matlab Editor] TMP: ' + err.message)
            }
          })

          // Execute the file in Matlab
          var fileName = editor.buffer.file.getBaseName()
          var currentDate = MatlabEditor.getCurrentDate()

          MatlabEditor.provider.add(currentDate + ' Running section of ' + fileName)
          MatlabEditor.executeText(MatlabEditor.tmpFileName, '1')
        } else {
          atom.notifications.addError('Unavailable Matlab Session',
            { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
        }
      }
    },

    // Run the current selection in Matlab
    runSelection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        if (MatlabEditor.checkSessionStatus()) {
          // Get the selected text
          var selectionText = ''
          var selections = editor.getSelections()

          if (selections.length !== 0) {
            for (let i = 0; i < selections.length; i++) {
              selectionText = selectionText + selections[i].getText()
            }

            // Create a temporary file
            MatlabEditor.tmpFileName = tmp.tmpNameSync({ prefix: 'AME_', postfix: '.m' })
            MatlabEditor.tmpFileName = MatlabEditor.cleanFileName(MatlabEditor.tmpFileName)
            fs.writeFile(MatlabEditor.tmpFileName, selectionText, (err) => {
              if (err) {
                console.log('[Atom Matlab Editor] TMP: ' + err.message)
              }
            })

            // Execute the file in Matlab
            var currentDate = MatlabEditor.getCurrentDate()

            MatlabEditor.provider.add(currentDate + ' Running selection')
            MatlabEditor.executeText(MatlabEditor.tmpFileName, '2')
          }
        } else {
          atom.notifications.addError('Unavailable Matlab Session',
            { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
        }
      }
    },

    // Open the first script/function in the path with the same name as the selected text
    openSelection () {
      var editor = atom.workspace.getActiveTextEditor()

      if (editor && editor.getGrammar().scopeName === 'source.matlab') {
        if (MatlabEditor.checkSessionStatus()) {
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
        } else {
          atom.notifications.addError('Unavailable Matlab Session',
            { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
        }
      }
    },

    // Run the command 'cmd', save the output and execute the callback 'clbk' when it's done
    runCommand (cmd, clbk) {
      var arch = MatlabEditor.getArch()
      var pathToMatlab = MatlabEditor.getMatlabPath()
      var pathToLib = path.join(atom.config.getUserConfigPath().replace('config.cson', ''), 'packages', 'atom-matlab-editor', 'lib', 'java')
      var matlabJava = path.join(pathToMatlab, 'sys', 'java', 'jre', arch, 'jre', 'bin', 'java')

      var command = '"' + matlabJava + '" -cp .;"' + path.join(pathToMatlab, 'extern', 'engines', 'java', 'jar', 'engine.jar') + '" javaMatlabConnect'
      var args = ['"' + cmd + '"', -1]
      var options = {
        cwd: pathToLib,
        shell: true
      }
      var stdout = (out) => { MatlabEditor.lastOutput = out }
      var exit = (code) => {
        MatlabEditor.logToConsole(code, cmd)
        if (clbk !== null) {
          clbk(code)
        }
      }

      MatlabEditor.process = new BufferedProcess({ command, args, options, stdout, exit })
    },

    // Execute the text/run the file 'inputText' in Matlab
    executeText (inputText, type) {
      var arch = MatlabEditor.getArch()
      var pathToMatlab = MatlabEditor.getMatlabPath()
      var pathToLib = path.join(atom.config.getUserConfigPath().replace('config.cson', ''), 'packages', 'atom-matlab-editor', 'lib', 'java')
      var matlabJava = path.join(pathToMatlab, 'sys', 'java', 'jre', arch, 'jre', 'bin', 'java')

      var command = '"' + matlabJava + '"' +
                    ' -cp .;"' + path.join(pathToMatlab, 'extern', 'engines', 'java', 'jar', 'engine.jar') + '"' +
                    ' javaMatlabConnect'
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

    // Collect and parse all possible errors encountered during the script execution
    collectAllErrors (error) {
      console.log('[Atom Matlab Editor] ERR: ' + error)

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
              const source = parsedError[i].split(/[<>]+/)
              const type = parsedError[i + 1].split('>')[1]
              const path = source[1].split('\'')[1]
              const line = source[1].split(/[,)]+/)[1]
              const col = source[1].split(/[,)]+/)[2]
              MatlabEditor.error.notification.detail = type + '\n(File: "' + path + '", Line: ' + line + ', Column: ' + col + ')'
              MatlabEditor.error.type = 1
            } else {
              // Runtime error
              MatlabEditor.error.notification.detail = errorText[1]
              MatlabEditor.error.type = 0
            }
          } else if (parsedError[i].endsWith('java.library.path\r')) {
            // "no nativenvm in java.library.path" error.
            // We have to visualize the notification now since the process doesn't end correctly.
            atom.notifications.addError('Failed to load nativenvm library', {
              detail: 'Please follow the instruction in the `atom-matlab-editor` package\'s readme.',
              dismissable: true
            })
          }
        }

        // Error stacktrace in case of Matlab runtine errors
        if (MatlabEditor.error.type === 0 && parsedError[i].startsWith('Error in')) {
          const stackCall = parsedError[i].split('==> ')[1]
          const path = stackCall.split('>')[0]
          const file = stackCall.split('>')[1].split(' at ')[0]
          const line = stackCall.split('>')[1].split(' at ')[1]
          MatlabEditor.error.notification.stack += 'Error in ' + file + ' (' + path + ':' + line + ')' + '\n'
        }
      }

      // console.log('[Atom Matlab Editor] ERR: ' + error)
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
      if (MatlabEditor.tmpFileName !== null) {
        fs.unlink(MatlabEditor.tmpFileName, (err) => {
          if (err) {
            console.log('[Atom Matlab Editor] TMP: ' + err.message)
          }
        })
        MatlabEditor.tmpFileName = null
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
      if (MatlabEditor.checkSessionStatus()) {
        var tab = document.querySelector('.texteditor.tab.right-clicked')
        var dirPath = path.dirname(tab.querySelector('.title').dataset.path)

        MatlabEditor.runCommand('cd(\'' + dirPath + '\')', null)
      } else {
        atom.notifications.addError('Unavailable Matlab Session',
          { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
      }
    },

    // Open file in Matlab
    openInMatlab () {
      if (MatlabEditor.checkSessionStatus()) {
        var filePath = document.querySelector('.tree-view').querySelector('.file.selected').querySelector('.name').dataset.path
        var fileExt = path.extname(filePath)
        var command

        if (fileExt === '.mat') {
          command = 'load(\'' + filePath + '\')'
        } else if (fileExt === '.m') {
          command = 'edit(\'' + filePath + '\')'
        } else {
          command = 'open(\'' + filePath + '\')'
        }
        MatlabEditor.runCommand(command, null)
      } else {
        atom.notifications.addError('Unavailable Matlab Session',
          { stack: '', detail: 'Unable to connect to MATLAB session.\nType "matlab.engine.shareEngine(\'AtomMatlabEngine\')" in your Matlab instance.', dismissable: true })
      }
    },

    // Log to Developer Tools console (debug)
    logToConsole (code, command) {
      if (atom.config.get('atom-matlab-editor.logToConsole')) {
        console.log('[Atom Matlab Editor] Command: \'' + command + '\' - Code: ' + code)
      }
    },

    // Format a file's name to Matlab standard
    cleanFileName (filePath) {
      var fileNameClean = path.basename(filePath, '.m').replace(/[^\w]/g, '_')
      return path.join(path.dirname(filePath), fileNameClean + '.m')
    },

    // Update Matlab Current Folder on the statusbar
    updateCurrentFolderStatusbar () {
      var pathToSettings = path.join(MatlabEditor.getMatlabPrefDir(), MatlabEditor.getMatlabSettingsFile())

      if (MatlabEditor.getMatlabSettingsFile().split('.')[1].startsWith('s')) {
        fs.readFile(pathToSettings, (err, text) => {
          if (err) {
            console.log(err)
          } else {
            var parser = new DOMParser()
            var xmlDoc = parser.parseFromString(text, 'text/xml')
            var cf = xmlDoc.querySelectorAll('key[name=LastFolderPath]')[1].children[0].children[0].textContent

            if (cf) {
              MatlabEditor.statusBarElement.updateText(cf)
            }
          }
        })
      } else if (MatlabEditor.getMatlabSettingsFile().split('.')[1].startsWith('m')) {
        var entries = new AdmZip(pathToSettings).getEntries()
        entries.forEach((item) => {
          if (item.entryName === 'fsroot/settingstree/matlab/workingfolder/settings.json') {
            var settings = JSON.parse(item.getData().toString('utf8'))
            settings.settings.forEach((item, _) => {
              if (item.name === 'LastFolderPath') {
                var cf = item.value.split('"').join('').split('\\\\').join('\\')

                if (cf) {
                  MatlabEditor.statusBarElement.updateText(cf)
                }
              }
            })
          }
        })

        // fs.createReadStream(pathToSettings)
        //   .pipe(unzip.Parse())
        //   .on('entry', (entry) => {
        //     console.log(entry)
        //     // if (entry.path === fileToExtract) {
        //     //   console.log('Extracting file ' + fileToExtract);
        //     //
        //     //   var fileName = fileToExtract.replace(/^.*[/]/, '');
        //     //   entry.pipe(fs.createWriteStream(extractToDirectory + fileName));
        //     // } else {
        //     //   entry.autodrain();
        //     // }
        //   })
      }
    },

    // Check Matlab sessions status
    checkSessionStatus () {
      if (MatlabEditor.sessionStatus === null) {
        MatlabEditor.forceCheckSessionStatus()
      }

      return MatlabEditor.sessionStatus
    },

    // Force check Matlab sessions status
    forceCheckSessionStatus () {
      var file = path.join(MatlabEditor.getMatlabTempDir(), 'AtomMatlabEngine')
      MatlabEditor.sessionStatus = fs.existsSync(file)
      MatlabEditor.statusBarElement.updateStatus(MatlabEditor.sessionStatus)
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

    // Get the Matlab preferences folder
    getMatlabPrefDir () {
      return atom.config.get('atom-matlab-editor.prefDirPath')
    },

    // Get the Matlab temporary folder
    getMatlabTempDir () {
      return atom.config.get('atom-matlab-editor.tempDirPath')
    },

    // Get the Matlab settings file
    getMatlabSettingsFile () {
      if (atom.config.get('atom-matlab-editor.legacyVersion')) {
        return 'matlab.settings'
      } else {
        return 'matlab.mlsettings'
      }
    },

    // Get the current date
    getCurrentDate () {
      var dateTime = new Date()
      return '[' + dateTime.getFullYear() + '/' +
                  (dateTime.getMonth() + 1).toString().padStart(2, '0') + '/' +
                   dateTime.getDate().toString().padStart(2, '0') + ' ' +
                   dateTime.getHours().toString().padStart(2, '0') + ':' +
                   dateTime.getMinutes().toString().padStart(2, '0') + ':' +
                   dateTime.getSeconds().toString().padStart(2, '0') + ']'
    }

  }
