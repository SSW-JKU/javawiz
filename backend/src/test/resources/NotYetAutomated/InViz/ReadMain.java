package inwiz;

import inout.Out;

public class ReadMain {
    public static void main (String[] args) {
        In.debugOutput();
        char x = In.read();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %s".formatted(x));
            x = In.read();
            In.debugOutput();
        }
    }
}
