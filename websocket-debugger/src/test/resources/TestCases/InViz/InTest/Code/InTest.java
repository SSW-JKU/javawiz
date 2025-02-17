import java.util.Arrays;
import java.util.stream.Collectors;

public class InTest {
    private static final String LINE_SEPERATOR = System.getProperty("line.separator");
    private static final String HERE = System.getProperty("user.dir") + "/src/test/resources/TestCases/InViz/InTest/Files/";
    private static final String intValueString = "123" + LINE_SEPERATOR + "45 89 0 ";
    private static final String  stringWithoutSpaces = "12345890";
    private static final double[] doubleValues = new double[] {123.45, 45.89, 89.2, .02, 7e8, -568.};
    private static final boolean[] booleanValues = new boolean[] {true, false, true, true, false, true};
    private static final long[] longValues = new long[] {123,-45 ,-89, 0, 78987609, 543241324, 10 ,3045};
    private static final String[] identifiers = new String[] {"true", "false", "java", "a", "x", "x2", "45u"};

    static final int[] intValues = new int[] {123, 45, 89, 0};
    public static void main(String[] args) {
        // Out.println("READ");
        testRead();
        In.close();

        // Out.println("READ INT");
        testReadInt();
        In.close();


        // Out.println("READ CHAR");
        testReadChar();
        In.close();

        // Out.println("READ LONG");
        testReadLong();
        In.close();

        // Out.println("READ DOUBLE");
        testReadDouble();
        In.close();

        // Out.println("READ FLOAT");
        testReadFloat();
        In.close();

        // Out.println("READ BOOLEAN");
        testReadBoolean();
        In.close();

        // Out.println("READ IDENTIFIER");
        testReadIdentifier();
        In.close();


        // Out.println("READ WORD");
        testReadWord();
        In.close();

        // Out.println("READ LINE");
        testReadLine();
        In.close();

        // Out.println("READ FILE");
        testReadFile();
        In.close();

        // Out.println("READ QUOTED");
        testReadQuoted();
        In.close();

        // Out.println("PEEK");
        testPeek();
        In.close();

        Out.println("DONE");
    }

    static void myAssert(boolean b, String failDestination) {
        if(!b) {
            System.err.println("FAILED at " + failDestination);
        }
    }

    static void testRead() {
        In.open(HERE + "file.txt");
        int i = 0;
        char c = In.read();
        while (In.done()) {
            // In.debugOutput();
            myAssert(intValueString.charAt(i) == c, "testRead loop");
            i++;
            c = In.read();
        }
        myAssert(c == '\uffff', "testRead end");
    }

    static void testReadInt() {
        In.open(HERE + "file.txt");
        int i = 0;
        int x = In.readInt();
        while (In.done()) {
            // In.debugOutput();
            myAssert(intValues[i] == x, "testReadInt loop");
            i++;
            x = In.readInt();
        }
    }


    private static final String[] textLines = new String[] {
            "Hello!",
            "",
            "How are you? I hope you are fine.",
            "Let's meet up sometime!",
            "Are you free tomorrow?",
            "",
            "See you! xo"
    };
    private static final String text = Arrays.stream(textLines).collect(Collectors.joining(LINE_SEPERATOR));
    private static final String[] strings = new String[] {"Hello", "How are you?", "I am fine, thanks!", "Bye"};

    static void testReadChar(){
        In.open(HERE + "file.txt");
        int i = 0;
        char c = In.readChar();
        while (In.done()) {
            // In.debugOutput();
            myAssert(stringWithoutSpaces.charAt(i) == c, "testReadChar loop");
            i++;
            c = In.readChar();
        }
        myAssert(c == '\uffff', "testReadChar end");
    }

    static void testReadLong(){
        In.open(HERE + "fileWithLongIntegers.txt");
        int i = 0;
        long l = In.readLong();
        while (In.done()) {
            // In.debugOutput();
            myAssert(longValues[i] == l, "testReadLong loop");
            i++;
            l = In.readLong();
        }
    }

    static void testReadDouble(){
        In.open(HERE + "fileWithDoubles.txt");
        int i = 0;
        double d = In.readDouble();
        while (In.done()) {
            // In.debugOutput();
            myAssert(doubleValues[i] == d, "testReadDouble loop");
            i++;
            d = In.readDouble();
        }
    }

    static void testReadFloat() {
        In.open(HERE + "fileWithDoubles.txt");
        int i = 0;
        float f = In.readFloat();
        while (In.done()) {
            // In.debugOutput();
            myAssert((float)doubleValues[i] == f, "testReadFloat loop");
            i++;
            f = In.readFloat();
        }
    }

    static void testReadBoolean(){
        In.open(HERE + "fileWithBooleans.txt");
        int i = 0;
        boolean b = In.readBoolean();
        while (In.done()) {
            // In.debugOutput();
            myAssert(booleanValues[i] == b, "testReadBoolean loop");
            i++;
            b = In.readBoolean();
        }
        myAssert(booleanValues[i] != b, "testReadBoolean end");
    }

    static void testReadIdentifier(){
        In.open(HERE + "fileWithIdentifiers.txt");
        int i = 0;
        String s = In.readIdentifier();
        while (In.done()) {
            // In.debugOutput();
            myAssert(identifiers[i].equals(s), "testReadIdentifier loop");
            i++;
            s = In.readIdentifier();
        }
    }


    static void testReadWord(){
        In.open(HERE + "file.txt");
        int i = 0;
        String s = In.readWord();
        while (In.done()) {
            // In.debugOutput();
            myAssert(String.valueOf(intValues[i]).equals(s), "testReadWord loop");
            i++;
            s = In.readWord();
        }
        myAssert(s.equals(""), "testReadWord end");
    }


    static void testReadLine() {
        In.open(HERE + "fileWithTextLines.txt");
        int i = 0;
        String s = In.readLine();
        while (In.done()) {
            // In.debugOutput();
            myAssert(textLines[i].equals(s), "testReadLine loop");
            i++;
            s = In.readLine();
        }
    }


    static void testReadFile() {
        In.open(HERE + "fileWithTextLines.txt");
        String s = In.readFile();
        myAssert(s.equals(text), "testReadFile");
    }

    static void testReadQuoted() {
        In.open(HERE + "fileWithStrings.txt");
        int i = 0;
        String s = In.readQuoted();
        while (In.done()) {
            // In.debugOutput();
            myAssert(strings[i].equals(s), "testReadQuoted loop");
            i++;
            s = In.readQuoted();
        }
        myAssert(!strings[i].equals(s), "testReadQuoted end");
    }

    static void testPeek(){
        In.open(HERE + "fileWithTextLines.txt");
        char x = In.peek();
        char y = In.readChar();
        while (In.done()) {
            // In.debugOutput();
            myAssert(x == y, "testPeek loop");
            x = In.peek();
            y = In.readChar();
        }
    }
}