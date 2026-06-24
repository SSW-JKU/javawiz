public class SwitchStmt {
    public static void main(String[] args) {
        int day = 4;
        switch(day) {
            case 1: case 2: case 3: case 4: case 5:
                Out.println("Weekday");
                break;
            case 6: case 7:
                Out.println("Weekend");
        }
    }
}