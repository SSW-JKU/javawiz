public class Main {
    public static void main(String[] args) {
        Dog a = new Dog("Rudy", 5);
        String[] todos = new String[] { "do homework", "study for exam" };
        // everything is assignable to Object
        Object x = a;
        Object y = todos;

        // this is trivially always true
        if (a instanceof Object) {
            Out.println(a + " is an Object!");
        }

        Out.println(x.hashCode());
        Out.println(y.hashCode());
        Out.println(x.getClass());
        Out.println(y.getClass());

        Dog b = new Dog("Lisa", 2);
        Dog c = new Dog("Rudy", 5);

        Out.println(a.equals(b));
        Out.println(x.equals(c));
        Out.println(y.equals(a));

        Out.println(b/* toString() is called automatically */);
        Out.println(c);

        Object[] objects = new Object[10];
        objects[0] = a;
        objects[1] = 1_234_567; // autoboxing
        objects[2] = false; // autoboxing
        objects[3] = 'c'; // autoboxing
        objects[4] = "Hello";
        objects[5] = Math.PI; // autoboxing

        Integer boxed = (Integer) objects[1];
        int i = boxed; // unboxing

        Out.println(i);

        for (Object o : objects) {
            if (o != null) {
                Out.println(String.format("%s (%s)", o, o.getClass()));
            }
        }

        final long myFinalVariable = 1000L;
        // won't compile
        // myFinalVariable = 1001L;

        final String[] passwords = new String[] { "1234axdföljsdafsdf", "934jöakjdsfsdf" };
        // won't compile
        // passwords = new String[0]

        // note that while passwords cannot be reassigned,
        // its content can still be modified
        passwords[0] = "haX0r'd";

        a.live();
        b.eat();
        c.makeSound();

        Animal a1 = a;
        AbstractAnimal a2 = a;

        // live is not part of the Animal interface
        // a1.live();
        // but eat/makeSound are
        a1.eat();
        a1.makeSound();

        a2.live();
    }
}
