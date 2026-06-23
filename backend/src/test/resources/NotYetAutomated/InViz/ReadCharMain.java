package inwiz;

import inout.Out;

public class ReadCharMain {
    public static void main (String[] args) {
        In.debugOutput();
        char x = In.readChar();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %s".formatted(x));
            x = In.readChar();
            In.debugOutput();
        }
    }
}
