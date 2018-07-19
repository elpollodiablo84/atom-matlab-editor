import com.mathworks.engine.*;
import java.io.*;

public class javaMatlabConnect {
    public static void main(String[] args) throws Exception {
        String myEngine = "AtomMatlabEngine";
        StringWriter writer = new StringWriter();
        MatlabEngine eng = MatlabEngine.connectMatlab(myEngine);
        File mainFile = new File(javaMatlabConnect.class.getResource("javaMatlabConnect.class").getPath());
        String javaDir = mainFile.getParent();

  		eng.eval(args[0], writer, null);
        String outString = writer.toString();
        eng.feval(0, "printTextFromOutside", "\n" + outString);
        System.out.println(outString);

        writer.close();
        eng.close();
    }
}
