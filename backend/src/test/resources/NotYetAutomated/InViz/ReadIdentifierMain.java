package inwiz;

import inout.Out;

public class ReadIdentifierMain {
    public static void main (String[] args) {
        In.debugOutput();
        String x = In.readIdentifier();
        In.debugOutput();
        while (In.done()) {
            Out.println("x = %s".formatted(x));
            x = In.readIdentifier();
            In.debugOutput();
        }
    }
}
