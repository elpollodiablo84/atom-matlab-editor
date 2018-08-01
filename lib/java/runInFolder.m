function runInFolder(file, folder)
    % This assures that the folder is removed from the path even if the function fails
    cleaner = onCleanup(@() rmpath(folder));

    addpath(folder);
    evalin('caller', ['run(''', file, ''')']);
end
