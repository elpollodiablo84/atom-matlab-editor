function printTextFromOutside(text, doAppendPrompt, isEditable, textToAddToHistory)
    %% Get GUI components
    try
        jTextArea = com.mathworks.mde.cmdwin.XCmdWndView.getInstance;
    catch
        jDesktop = com.mathworks.mde.desk.MLDesktop.getInstance;
        commandwindow;
        jTextArea = jDesktop.getMainFrame.getFocusOwner;
    end
    cmdWinDoc = jTextArea.getDocument();

    %% Some Reflection magic to get some usefull private methods
    cmdWinDocClass = cmdWinDoc.getClass();

    % CmdWinDocument.appendprompt: append a prompt to the Command Window's text
    if (doAppendPrompt)
        mAppendPrompt = javaMethodEDT('getDeclaredMethod', cmdWinDocClass, 'appendPrompt', []);
        mAppendPrompt.setAccessible(true);
    end

    % CmdWinDocument.shouldSyntaxHighlight: toggle on/off the Command Window's syntax highlighting
    inputClasses = javaArray('java.lang.Class', 1);
    inputClasses(1) = java.lang.Boolean.TYPE;
    mShouldSyntaxHighlight = javaMethodEDT('getDeclaredMethod', cmdWinDocClass, 'shouldSyntaxHighlight', inputClasses);
    mShouldSyntaxHighlight.setAccessible(true);

    %% Display the text
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, false)

    javaMethodEDT('append', jTextArea, sprintf(text))
    if (doAppendPrompt)
        javaMethodEDT('invoke', mAppendPrompt, cmdWinDoc, [])
    end

    javaMethodEDT('setEditable', jTextArea, isEditable)
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, true)
    javaMethodEDT('setCaretPosition', jTextArea, jTextArea.getText().length())

    javaMethodEDT('repaint', jTextArea)

    %% Add the command to the command history
    if (strlength(textToAddToHistory) > 0)
        com.mathworks.mlservices.MLCommandHistoryServices.add(textToAddToHistory);
    end
end
