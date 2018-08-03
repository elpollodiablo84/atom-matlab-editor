# Atom Matlab Editor
MATLAB Editor's functionalities and utilities in Atom.

### Installation
Execute `matlab.engine.shareEngine('AtomMatlabEngine')` in your current MATLAB instance, or put the line in your [`startup.m`](https://it.mathworks.com/help/matlab/matlab_env/startup-options.html#brlkmbe-1).

Insert the MATLAB root path and the computer architecture in the package's config (check the config for instructions).

The package should work without any other program installed, since it uses the Java executable shipped with your version of MATLAB.

### Planned Features
- Run current file, section, row or selected text in the current MATLAB instance.
- Call the MATLAB help in the Atom Editor.
