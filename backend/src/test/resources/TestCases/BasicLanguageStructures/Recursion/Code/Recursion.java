public class Recursion {
    public static void main(String[] args) {
        Out.println(fib(3));
    }

    static int fib(int i) {
        if(i < 2) {
            return 1;
        } else {
            return fib(i - 1) + fib(i - 2);
        }
    }
}