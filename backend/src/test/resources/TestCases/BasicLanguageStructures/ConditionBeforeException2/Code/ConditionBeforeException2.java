public class ConditionBeforeException2 {
    public static void main(String[] args) {
        if(bar()) {
            if(foo()) {
                int i = 1;
            }
        }
    }

    static boolean bar() {
        return true;
    }

    static boolean foo() {
        return 1 == new int[]{}[0];
    }
}