public class StepRequests {
    static void line() {
        over();
        over();
        System.out.println("line");
        System.out.print("Step ");
    }
    public static void main(String[] args) {
        System.out.print("Step ");
        System.out.println("into");
        System.out.print("Step ");
        System.out.println("over");
        System.out.print("Step ");
        into();
        System.out.println("out");
        System.out.print("Run to ");
        line();
        System.out.println(" out");
        System.out.print("Run to ");
        over();
        over();
        System.out.println("end");
    }

    static void into() {
        System.out.println("into");
        System.out.print("Step ");
        over();
        System.out.println("over");
        System.out.print("Step ");
        stepOut();
        System.out.println("out");
        System.out.println("Step Into");
        System.out.print("Step ");
        System.out.print("...");
    }

    static void over() {
        System.out.print("...");
    }

    static void stepOut() {
        System.out.println("into");
        System.out.print("Step ");
    }
}