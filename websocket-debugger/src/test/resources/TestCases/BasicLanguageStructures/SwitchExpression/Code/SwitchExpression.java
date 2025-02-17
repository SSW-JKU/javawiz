public class SwitchExpression {
    public static void main(String[] args) {
        int digit = 3;
        Out.println(switch(digit) {
            case 1 -> "one";
            case 2 -> "two";
            case 3 -> "three";
            default -> {
                Out.println("digit too large");
                yield "";
            }
        });
    }
}