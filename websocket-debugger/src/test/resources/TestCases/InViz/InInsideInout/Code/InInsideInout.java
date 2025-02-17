import inout.In;

public class InInsideInout {
    public static void main(String[] args) {
        In.open(System.getProperty("user.dir") + "/src/test/resources/TestCases/InViz/InInsideInout/numbers.txt");
        System.out.println(In.done());
        int a = In.readInt();
    }
}