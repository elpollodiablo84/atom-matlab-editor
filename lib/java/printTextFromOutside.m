function textInPromptLine = printTextFromOutside(text, removePrompt, appendPrompt, highlightSyntax, isEditable, textToAddToHistory, textToAddToPrompt)
    % INPUTS:
    % #1 -> text (string)
    % #2 -> remove current prompt (boolean)
    % #3 -> append prompt after text (boolean)
    % #4 -> allow syntax highlighting (boolean)
    % #5 -> set the command window editable (boolean)
    % #6 -> text to add to the command history (string)
    % #7 -> text to add to the command window after the prompt (string)

    % OUTPUT:
    % #1 -> text after prompt (string)

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
    if (appendPrompt)
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
    if ~(highlightSyntax)
        javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, false);
    end

    % Get text already in line
    ps = javaMethodEDT('invoke', mGetPromptOffset, cmdWinDoc, []);
    pe = javaMethodEDT('invoke', mGetInUsePromptLength, cmdWinDoc, []);
    L = javaMethodEDT('getLength', cmdWinDoc);
    if (ps + pe < L)
        textInPromptLine = char(javaMethodEDT('getText', cmdWinDoc, ps + pe, L - ps - pe));
    else
        textInPromptLine = "";
    end

    if (~isEditable)
        javaMethodEDT('removeCurrentPromptLine', cmdWinDoc);
    end

    if (removePrompt)
        javaMethodEDT('remove', cmdWinDoc, ps, pe);
    end

    javaMethodEDT('append', jTextArea, char(text))
    if (appendPrompt)
        javaMethodEDT('invoke', mAppendPrompt, cmdWinDoc, []);
        if ~isempty(textToAddToPrompt)
            javaMethodEDT('append', jTextArea, char(textToAddToPrompt))
        end
    end

    javaMethodEDT('setEditable', jTextArea, isEditable);
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, true);
    javaMethodEDT('setCaretPosition', jTextArea, jTextArea.getText().length());

    %% Add the command to the command history
    if (strlength(textToAddToHistory) > 0)
        altHistory = com.mathworks.mde.cmdhist.AltHistory.getInstance();
        fCollection = getDeclaredField(altHistory.getClass(), 'fCollection');
        fCollection.setAccessible(true);
        altHistoryCollection = fCollection.get(altHistory);

        % AltHistoryCollection.interruptSaveAll(): interrupt save process
        mInterruptSaveAll = getDeclaredMethod(altHistoryCollection.getClass(), 'interruptSaveAll', []);
        mInterruptSaveAll.setAccessible(true);

        % AltHistoryCollection.restartInterruptedSave(): restart save process
        mRestartInterruptedSave = getDeclaredMethod(altHistoryCollection.getClass(), 'restartInterruptedSave', []);
        mRestartInterruptedSave.setAccessible(true);

        % Add the command(s)
        linesToAdd = splitlines(textToAddToHistory);
        jLinesToAdd = javaArray('java.lang.String', length(linesToAdd));
        for i = 1:length(linesToAdd)
            jLinesToAdd(i) = java.lang.String(linesToAdd{i});
        end
        jLinesToAdd = java.util.Arrays.asList(jLinesToAdd);

        javaMethodEDT('invoke', mInterruptSaveAll, altHistoryCollection, []);
        javaMethodEDT('addCommands', altHistoryCollection, jLinesToAdd);

        % We need to update manually the batchId of the record(s)
        if (length(linesToAdd) == 1)
            commandRecordList = altHistoryCollection.getCommandRecordList();
            iBatchId = getDeclaredField(commandRecordList.get(0).getClass(), 'iBatchId');
            iBatchId.setAccessible(true);
            iBatchId.set(commandRecordList.get(commandRecordList.size()-1), java.util.concurrent.atomic.AtomicInteger(-1))
        else
            fBatchId = getDeclaredField(altHistoryCollection.getClass(), 'fBatchId');
            fBatchId.setAccessible(true);
            fBatchId.set(altHistoryCollection, java.lang.Integer(fBatchId.get(altHistoryCollection) + 1));
        end

        javaMethodEDT('invoke', mRestartInterruptedSave, altHistoryCollection, []);
    end

    %% Update jTextArea
    javaMethodEDT('repaint', jTextArea);
end
