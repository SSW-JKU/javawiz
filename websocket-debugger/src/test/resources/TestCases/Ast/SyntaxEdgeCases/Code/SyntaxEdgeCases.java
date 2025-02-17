// Main class definition
public class SyntaxEdgeCases {

    // Enum definition
    public enum Days {
        SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY
    }

    // Interface definition
    interface Greet {
        void sayHello();
    }

    // Abstract class definition
    abstract static class Animal {
        abstract void makeSound();
    }

    // Class extending abstract class and implementing interface
    static class Dog extends Animal implements Greet {
        // Instance variables
        private String name;
        private int age;

        // Static variable
        static int numberOfDogs;

        // Constructor
        public Dog(String name, int age) {
            this.name = name;
            this.age = age;
            numberOfDogs++;
        }

        // Method overriding abstract method
        @Override
        void makeSound() {
            System.out.println("Bark");
        }

        // Method overriding interface method
        @Override
        public void sayHello() {
            System.out.println("Hello, I am a dog!");
        }

        // Static method
        public static void displayDogCount() {
            System.out.println("Number of dogs: " + numberOfDogs);
        }

        // Example of a method with an empty block
        public void doNothing() {
            // This is an empty block
        }
    }

    // Main method
    public static void main(String[] args) {
        // Variable declaration and initialization
        int x = 5;
        double y = 10.5;

        int[] numbers = {1, 2, 3, 4, 5};

        Dog myDog = new Dog("Buddy", 3);

        myDog.makeSound();
        myDog.sayHello();
        Dog.displayDogCount();

        if (x < y) {
            System.out.println("x is less than y");
        } else if (x == y) {
            System.out.println("x is equal to y");
        } else {
            System.out.println("x is greater than y");
        }

        Days day = Days.MONDAY;
        switch (day) {
            case SUNDAY:
                System.out.println("It's Sunday!");
                break;
            case MONDAY: case TUESDAY:
                System.out.println("It's Monday!");
                break;
            case WEDNESDAY: break;
            default:
                System.out.println("It's a weekday!");
                break;
        }

        for (int i = 0; i < numbers.length; i++) {
            System.out.println(numbers[i]);
        }

        int j = 0;
        while (j < numbers.length) {
            System.out.println(numbers[j]);
            j++;
        }

        int k = 0;
        do {
            System.out.println(numbers[k]);
            k++;
        } while (k < numbers.length);

        try {
            int result = x / 0;
        } catch (ArithmeticException e) {
            System.out.println("Division by zero error");
        } finally {
            System.out.println("This is the finally block");
        }

        for (int number : numbers) {
            System.out.println(number);
        }

        class InnerClass {
            void innerMethod() {
                System.out.println("This is an inner class method");
            }
        }

        InnerClass inner = new InnerClass();
        inner.innerMethod();

        Greet greet = new Greet() {
            @Override
            public void sayHello() {
                System.out.println("Hello from anonymous class!");
            }
        };
        greet.sayHello();

        class EmptyClass {
        }

        EmptyClass empty = new EmptyClass();
    }
}
