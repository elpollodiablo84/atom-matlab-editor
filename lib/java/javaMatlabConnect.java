import com.mathworks.engine.*;
import java.io.*;

public class javaMatlabConnect {
    public static void main(String[] args) throws Exception {
        // INPUT:
        // args[0] -> Command/File to be executed in Matlab
        // args[1] -> Call type: 0 - Run file
        //                       1 - Run section or line

        // INPUT Matlab function printTextFromOutside:
        // #1 -> text (string)
        // #2 -> append prompt after text (boolean)
        // #3 -> set the command window editable (boolean)
        // #4 -> text to add to the command history (string)

        String myEngine = "AtomMatlabEngine";
        StringWriter writer = new StringWriter();
        MatlabEngine eng = MatlabEngine.connectMatlab(myEngine);
        String inputText = args[0];
        int type = Integer.parseInt(args[1]);
        String outString = "";

        if (type == 0) {
            // Run File: 'inputText' is the file path
            File file = new File(inputText);
            String fileName = file.getName().toString().split("[.]")[0];
            eng.feval(0, "printTextFromOutside", fileName + "\n", false, true, fileName);

            eng.eval("run(\'" + inputText + "\')", writer, null);
            outString = writer.toString();

            eng.feval(0, "printTextFromOutside", outString, true, true, "");
        } else if (type == 1) {
            // Run Section or Line: 'inputText' is the temporary file path
            eng.eval("run(\'" + inputText + "\')", writer, null);
            outString = writer.toString();

            eng.feval(0, "printTextFromOutside", "\n" + outString, true, true, "");
        } else {
            // Run 'inputText' without printing on the command window
            eng.eval(inputText, null, null);
            outString = "";
        }

        System.out.println(outString);

        writer.close();
        eng.close();
    }
}
