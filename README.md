# Atom Matlab Editor
MATLAB Editor's functionalities and utilities in Atom.

![](https://github.com/elpollodiablo84/atom-matlab-editor/raw/master/images/screen_00.png)

### Setup
1. Execute `matlab.engine.shareEngine('AtomMatlabEngine')` in your current MATLAB instance, or [put the line in your `startup.m`](https://mathworks.com/help/matlab/matlab_env/startup-options.html#brlkmbe-1).

2. Add the folder `[...]\.atom\packages\atom-matlab-editor\lib\java` to your MATLAB [search path](https://mathworks.com/help/matlab/search-path.html).

3. Insert all the needed informations in the package's config.
    - To retrieve your MATLAB root path, type `matlabroot` in your MATLAB instance.
    - For the computer architecture, type `computer('arch')`.
    - For the preferences folder and temporary folder, type respectively `prefdir` and `tempdir`.
    - Select the relative checkbox if your MATLAB version is __strictly__ older than R2020a.

4. In case of _"no nativemvm in java.library.path"_ error: add the correct path to your environmental variables as explained in [this MATLAB Answers thread](https://mathworks.com/matlabcentral/answers/320234-using-java-api-gives-no-nativemvm-in-java-library-path#answer_259968), and then restart Atom.

### How it works
Atom Matlab Editor utilizes Java as a bridge between Atom and MATLAB, without the need to have a separate Java installation since the package uses the executable shipped with MATLAB.

__WARNING__: _This package is developed on Windows with MATLAB R2020a (initially with R2017a). It's safe to assume that the package works for all the versions in between._
For now the focus is on implementing/polishing all the features, therefore compatibility with versions older than R2017a is not guaranteed. For this reason, remember to specify your OS and MATLAB version in any bug report.

### Features
- Run file (`F5`), section (`CTRL+F5`) or selection (`F9`) in the current MATLAB instance.
- Save and run file (`ALT-F5`). Be careful, sometimes MATLAB fails to notice that a file has been modified by an external editor.
- Call the MATLAB help in the Atom Editor (`F1` on selection).
- Open function/script file in MATLAB search path from the Atom Editor (`CTRL+F1`).
- Change current folder in Matlab from Atom (`Right-Click` on the relative TextEditor tab).
- Open file in Matlab (`Right-Click` on the TreeView item).
- Check your Current Matlab Folder directly on the Atom statusbar.

### Planned Features
- Change Current Matlab Folder from the statusbar.
- Compatibility with versions less than R2017a.
