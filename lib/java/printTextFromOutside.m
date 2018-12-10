function printTextFromOutside(text, doRemovePrompt, doAppendPrompt, isEditable, textToAddToHistory)
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

    % CmdWinDocument.appendprompt(): append a prompt to the Command Window's text
    if (doAppendPrompt)
        mAppendPrompt = getDeclaredMethod(cmdWinDocClass, 'appendPrompt', []);
        mAppendPrompt.setAccessible(true);
    end

    % CmdWinDocument.shouldSyntaxHighlight(boolean): toggle on/off the Command Window's syntax highlighting
    inputClasses = javaArray('java.lang.Class', 1);
    inputClasses(1) = java.lang.Boolean.TYPE;
    mShouldSyntaxHighlight = getDeclaredMethod(cmdWinDocClass, 'shouldSyntaxHighlight', inputClasses);
    mShouldSyntaxHighlight.setAccessible(true);

    % CmdWinDocument.getPromptOffset(): get position of Prompt
    mGetPromptOffset = getDeclaredMethod(cmdWinDocClass, 'getPromptOffset', []);
    mGetPromptOffset.setAccessible(true);

    % CmdWinDocument.getInUsePromptLength(): get length of current Prompt
    mGetInUsePromptLength = getDeclaredMethod(cmdWinDocClass, 'getInUsePromptLength', []);
    mGetInUsePromptLength.setAccessible(true);

    %% Display the text
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, false);

    if (~isEditable)
        javaMethodEDT('removeCurrentPromptLine', cmdWinDoc);
    end

    if (doRemovePrompt)
        ps = javaMethodEDT('invoke', mGetPromptOffset, cmdWinDoc, []);
        pe = javaMethodEDT('invoke', mGetInUsePromptLength, cmdWinDoc, []);
        javaMethodEDT('remove', cmdWinDoc, ps, pe);
    end

    javaMethodEDT('append', jTextArea, sprintf(text))
    if (doAppendPrompt)
        javaMethodEDT('invoke', mAppendPrompt, cmdWinDoc, []);
    end

    javaMethodEDT('setEditable', jTextArea, isEditable);
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, true);
    javaMethodEDT('setCaretPosition', jTextArea, jTextArea.getText().length());

    javaMethodEDT('repaint', jTextArea);

    %% Add the command to the command history
    if (strlength(textToAddToHistory) > 0)
        altHistory = com.mathworks.mde.cmdhist.AltHistory.getInstance();
        fCollection = getDeclaredField(altHistory.getClass(), 'fCollection');
        fCollection.setAccessible(true);
        altHistoryCollection = fCollection.get(altHistory);

        % Add the command
        altHistoryCollection.addCommand(textToAddToHistory)

        % We need to update manually the batchId of the record
        commandRecordList = altHistoryCollection.getCommandRecordList();
        iBatchId = getDeclaredField(commandRecordList.get(0).getClass(), 'iBatchId');
        iBatchId.setAccessible(true);
        iBatchId.set(commandRecordList.get(commandRecordList.size()-1), java.util.concurrent.atomic.AtomicInteger(-1))
    end
end
