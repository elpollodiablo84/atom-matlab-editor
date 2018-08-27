# Atom Matlab Editor
MATLAB Editor's functionalities and utilities in Atom.

### Installation
1. Execute `matlab.engine.shareEngine('AtomMatlabEngine')` in your current MATLAB instance, or put the line in your [`startup.m`](https://it.mathworks.com/help/matlab/matlab_env/startup-options.html#brlkmbe-1).

2. Add the folder `PATH_TO_YOUR_.atom_FOLDER\packages\atom-matlab-editor\lib\java` to your MATLAB [search path](https://it.mathworks.com/help/matlab/search-path.html).

3. Insert the MATLAB root path and the computer architecture in the package's config (check the config for instructions).

There is no need to have a separate installation of Java, since the package uses the Java executable shipped with your version of MATLAB.

__WARNING__: This package is developed/tested with _MATLAB R2017a_ on _Windows_. For now the focus is on implementing all the features, therefore compatibility with different versions is not guaranteed. For this reason, remember to specify your MATLAB version and OS in any bug report!

### Features
- Run file or section in the current MATLAB instance.

### Planned Features
- Run row or selected text in the current MATLAB instance.
- Call the MATLAB help in the Atom Editor.
- Compatibility with versions different from R2017a.
