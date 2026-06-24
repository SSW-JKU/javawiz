public class IfElse {
    public static void main(String[] args) {
        int i = 0;
        if(i == 0) {
            Out.println("i is zero");
        } else {
            Out.println("i is nonzero");
        }

        if(i != 0) {
            Out.println("i is nonzero");
        } else if(i  == 0) {
            Out.println("i is zero");
        }
    }
}