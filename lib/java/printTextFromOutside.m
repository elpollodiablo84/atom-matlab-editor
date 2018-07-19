function printTextFromOutside(text)
    jDesktop = com.mathworks.mde.desk.MLDesktop.getInstance;
    try
        cmdWin = jDesktop.getClient('Command Window');
        jTextArea = cmdWin.getComponent(0).getViewport.getComponent(0);
    catch
        commandwindow;
        jTextArea = jDesktop.getMainFrame.getFocusOwner;
    end
    cmdWinDoc = jTextArea.getDocument();

    cmdWinDocClass = cmdWinDoc.getClass();
    mAppendPrompt = javaMethodEDT('getDeclaredMethod', cmdWinDocClass, 'appendPrompt', []);
    inputClasses = javaArray('java.lang.Class',1);
    inputClasses(1) = java.lang.Boolean.TYPE;
    mShouldSyntaxHighlight = javaMethodEDT('getDeclaredMethod', cmdWinDocClass, 'shouldSyntaxHighlight', inputClasses);
    mAppendPrompt.setAccessible(true);
    mShouldSyntaxHighlight.setAccessible(true);

    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, false);
    javaMethodEDT('append', jTextArea, sprintf(text + '\n'))
    javaMethodEDT('invoke', mAppendPrompt, cmdWinDoc, []);
    javaMethodEDT('invoke', mShouldSyntaxHighlight, cmdWinDoc, true);
    javaMethodEDT('repaint', jTextArea)
end
