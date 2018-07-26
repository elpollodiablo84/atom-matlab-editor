import com.mathworks.engine.*;
import java.io.*;

public class javaMatlabConnect {
    public static void main(String[] args) throws Exception {
        // INPUT:
        // args[0] = Command to be executed in Matlab
        // args[1] = Call type: 0 - Run file
        //                      1 - Run section, line or text
        String myEngine = "AtomMatlabEngine";
        StringWriter writer = new StringWriter();
        MatlabEngine eng = MatlabEngine.connectMatlab(myEngine);
        String command = args[0];
        int type = Integer.parseInt(args[1]);
        String outString = "";

        if (type == 0) {
            // Run File: 'command' is only the file path
            File file = new File(command);
            String fileName = file.getName().toString().split("[.]")[0];
            eng.feval(0, "printTextFromOutside", fileName + "\n", false);

            eng.eval("run(\'" + command + "\')", writer, null);
            outString = writer.toString();

            eng.feval(0, "printTextFromOutside", outString, true);
        } else if (type == 1) {
            eng.eval(command, writer, null);
            outString = writer.toString();

            eng.feval(0, "printTextFromOutside", "\n" + outString);
        } else {
            eng.eval(command, writer, null);
            outString = writer.toString();
        }

        System.out.println(outString);

        writer.close();
        eng.close();
    }
}
