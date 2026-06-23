package inwiz;

import inout.Out;

public class PeekMain {
    public static void main (String[] args) {
        In.debugOutput();
        char x = In.peek();
        In.debugOutput();
        char y = In.readChar();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %s, y = %s".formatted(x, y));
            x = In.peek();
            In.debugOutput();
            y = In.readChar();
            In.debugOutput();
        }
    }
}
