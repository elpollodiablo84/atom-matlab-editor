import com.mathworks.engine.*;
import java.io.*;
import java.nio.file.*;

public class javaMatlabConnect {
    public static void main(String[] args) throws Exception {
        // INPUT:
        // args[0] -> Command/File to be executed in MATLAB
        // args[1] -> Call type: 0 - Run file
        //                       1 - Run section
        //                       2 - Run selection

        // INPUTS of MATLAB function printTextFromOutside:
        // #1 -> selectionText (string)
        // #2 -> remove current prompt (boolean)
        // #3 -> append prompt after selectionText (boolean)
        // #4 -> set the command window editable (boolean)
        // #5 -> selectionText to add to the command history (string)
        // #6 -> selectionText to add to the command window after the prompt (string)

        // OUTPUT of MATLAB function printTextFromOutside:
        // #1 -> selectionText after prompt (string)

        String myEngine = "AtomMatlabEngine";
        StringWriter writer = new StringWriter();
        MatlabEngine eng = MatlabEngine.connectMatlab(myEngine);
        String inputText = args[0];
        int type = Integer.parseInt(args[1]);
        String outString = "";
        String textInPromptLine = "";

        try {
            if (type == 0) {
                // --- RUN FILE
                // 'inputText' is the file path
                File file = new File(inputText);
                String fileName = file.getName().toString().split("[.]")[0];

                // Display the file name in the command window
                textInPromptLine = eng.feval(1, "printTextFromOutside", fileName + "\n", false, false, false, false, fileName, "");

                // Run the file
                eng.eval(fileName, writer, null);
                outString = writer.toString();

                // Append the prompt
                eng.feval(0, "printTextFromOutside", outString, false, true, true, true, "", textInPromptLine);
            } else if (type == 1) {
                // --- RUN SECTION
                textInPromptLine = eng.feval(1, "printTextFromOutside", "", true, false, false, false, "", "");

                // 'inputText' is the temporary file path
                eng.eval("runInFolder(\'" + inputText + "\', pwd)", writer, null);
                outString = writer.toString();

                // Append the prompt
                eng.feval(0, "printTextFromOutside", outString, false, true, true, true, "", textInPromptLine);
            } else if (type == 2) {
                // --- RUN SELECTION
                // 'inputText' is the temporary file path
                String selectionText = new String(Files.readAllBytes(Paths.get(inputText)));

                textInPromptLine = eng.feval(1, "printTextFromOutside", selectionText + "\n", false, false, true, false, selectionText, "");

                eng.eval("runInFolder(\'" + inputText + "\', pwd)", writer, null);
                outString = writer.toString();

                // Append the prompt
                eng.feval(0, "printTextFromOutside", outString, false, true, true, true, "", textInPromptLine);
            } else {
                // Run 'inputText' without printing on the command window
                eng.eval(inputText, writer, null);
                outString = writer.toString();
            }

            // Debug
            // System.out.println(textInPromptLine);
            // System.out.println(outString);

            writer.close();
            eng.close();

        } catch (Exception e) {
            // This ensures that the MATLAB command window is set to editable in case of errors
            eng.feval(0, "printTextFromOutside", "", false, true, false, true, "", "");

            throw e;
        }
    }
}
