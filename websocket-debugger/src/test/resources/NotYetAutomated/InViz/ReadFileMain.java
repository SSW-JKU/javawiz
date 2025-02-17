package inwiz;

import inout.Out;

public class ReadFileMain {
    public static void main (String[] args) {
        In.open("src/test/java/inwiz/file.txt");
        In.debugOutput();
        String x = In.readFile();
        In.debugOutput();
        Out.println("x = %s".formatted(x));
    }
}
