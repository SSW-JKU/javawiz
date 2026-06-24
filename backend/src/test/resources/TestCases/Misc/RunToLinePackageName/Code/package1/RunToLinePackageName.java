package package1;

import package2.*;

public class RunToLinePackageName {


    public static void main(String[] args) {
        package2.RunToLinePackageName.foo();
        System.out.println("apparantly not");
        System.out.println("but this one is");

    }
}