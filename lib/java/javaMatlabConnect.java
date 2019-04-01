import com.mathworks.engine.*;
import java.io.*;

public class javaMatlabConnect {
    public static void main(String[] args) throws Exception {
        // INPUT:
        // args[0] -> Command/File to be executed in MATLAB
        // args[1] -> Call type: 0 - Run file
        //                       1 - Run section or selection

        // INPUTS of MATLAB function printTextFromOutside:
        // #1 -> text (string)
        // #2 -> remove current prompt (boolean)
        // #3 -> append prompt after text (boolean)
        // #4 -> set the command window editable (boolean)
        // #5 -> text to add to the command history (string)
        // #6 -> text to add to the command window after the prompt (string)

        // OUTPUT of MATLAB function printTextFromOutside:
        // #1 -> text after prompt (string)

        String myEngine = "AtomMatlabEngine";
        StringWriter writer = new StringWriter();
        MatlabEngine eng = MatlabEngine.connectMatlab(myEngine);
        String inputText = args[0];
        int type = Integer.parseInt(args[1]);
        String outString = "";
        String textInPromptLine = "";

        try {
            if (type == 0) {
                // Run File: 'inputText' is the file path
                File file = new File(inputText);
                String fileName = file.getName().toString().split("[.]")[0];

                // Display the file name in the command window
                textInPromptLine = eng.feval(1, "printTextFromOutside", fileName + "\n", false, false, false, fileName, "");

                // Run the file
                eng.eval(fileName, writer, null);
                outString = writer.toString();

                // Append the prompt
                eng.feval(0, "printTextFromOutside", outString, false, true, true, "", textInPromptLine);
            } else if (type == 1) {
                textInPromptLine = eng.feval(1, "printTextFromOutside", "", true, false, false, "", "");

                // Run Section or Selection: 'inputText' is the temporary file path
                eng.eval("runInFolder(\'" + inputText + "\', pwd)", writer, null);
                outString = writer.toString();

                eng.feval(0, "printTextFromOutside", outString, false, true, true, "", textInPromptLine);
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
            eng.feval(0, "printTextFromOutside", "", false, true, true, "", "");

            throw e;
        }
    }
}
