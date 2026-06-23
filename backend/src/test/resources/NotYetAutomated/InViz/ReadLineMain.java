package inwiz;

import inout.Out;

public class ReadLineMain {
    public static void main (String[] args) {
        In.debugOutput();
        String x = In.readLine();
        In.debugOutput();
        while (In.done()) {
            Out.println("x = %s".formatted(x));
            x = In.readLine();
            In.debugOutput();
        }
    }
}
