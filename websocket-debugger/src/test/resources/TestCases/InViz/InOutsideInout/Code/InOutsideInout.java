public class InOutsideInout {
    public static void main(String[] args) {
        System.out.println(System.getProperty("user.dir"));
        In.open(System.getProperty("user.dir") + "/src/test/resources/TestCases/InViz/InOutsideInout/numbers.txt");
        System.out.println(In.done());
        int a = In.readInt();
    }
}