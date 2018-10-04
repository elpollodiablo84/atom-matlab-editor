# Atom Matlab Editor
MATLAB Editor's functionalities and utilities in Atom.

### Installation
1. Execute `matlab.engine.shareEngine('AtomMatlabEngine')` in your current MATLAB instance, or put the line in your [`startup.m`](https://mathworks.com/help/matlab/matlab_env/startup-options.html#brlkmbe-1).

2. Add the folder `\.atom\packages\atom-matlab-editor\lib\java` to your MATLAB [search path](https://mathworks.com/help/matlab/search-path.html).

3. Insert the MATLAB root path and the computer architecture in the package's config (check the config for instructions).

Atom Matlab Editor utilizes Java as a bridge between Atom and Matlab, but there is no need to have a separate Java installation, since the package uses the executable shipped with your version of MATLAB.

__WARNING__: _This package is developed/tested on Windows with MATLAB R2017a_.
For now the focus is on implementing all the features, therefore compatibility with different versions is not guaranteed. For this reason, remember to specify your OS and MATLAB version in any bug report!

### Features
- Run file (`F5`), section (`CTRL+F5`) or selection (`F9`) in the current MATLAB instance.
- Call the MATLAB help in the Atom Editor (`F1`).

### Planned Features
- Panel showing current MATLAB folder contents.
- Open function/script file in MATLAB search path from the Atom Editor (like `CTRL+D` in MATLAB).
- Compatibility with versions different from R2017a.
