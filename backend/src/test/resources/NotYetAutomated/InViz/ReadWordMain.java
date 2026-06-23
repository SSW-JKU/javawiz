package inwiz;

import inout.Out;

public class ReadWordMain {
    public static void main (String[] args) {
        In.debugOutput();
        String x = In.readWord();
        In.debugOutput();
        while (In.done()) {
            Out.println("x = %s".formatted(x));
            x = In.readWord();
            In.debugOutput();
        }
    }
}
