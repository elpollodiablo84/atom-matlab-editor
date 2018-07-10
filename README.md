# Atom Matlab Editor
MATLAB Editor's functionalities and utilities in Atom.

### Installation
Execute `matlab.engine.shareEngine('AtomMatlabEngine')` in your current Matlab instance, or put the line in your `startup.m`.

The package should work out-of-the-box, since it uses the Java executable shipped with your version of Matlab. If you have problems or a non-standard Matlab installation, check the package's config.

### Planned Features
- Run current file, section, row or selected text in the current Matlab instance.
- Call the Matlab help in the Atom Editor.
