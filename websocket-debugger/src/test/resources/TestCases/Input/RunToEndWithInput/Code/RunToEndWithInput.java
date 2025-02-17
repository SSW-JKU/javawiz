public class RunToEndWithInput {
    public static void main(String[] args) {
        Out.println("Test Start 1");
        Out.println("Test Start 2");
        Out.println("Test Start 3");
        int a = In.readInt();
        Out.println("Test Middle 1");
        Out.println("Test Middle 2");
        int b = In.readInt();
        readingMethod();
        Out.println("Test End 1");
        Out.println("Test End 2");
    }

    public static void readingMethod() {
        Out.println("readingMethod Start");
        int c = In.readInt();
        Out.println("readingMethod End");
    }
}