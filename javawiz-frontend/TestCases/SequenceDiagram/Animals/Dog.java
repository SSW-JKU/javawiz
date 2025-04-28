public /* final */ class Dog extends AbstractAnimal {
    // public final String name;
    // public final int age;

    public Dog(String name, int age) {
        super(name, age);
        // both final fields must be initialized
        // but are now set in the superclass
        // this.name = name;
        // this.age = age;
    }

    @Override
    public boolean equals(Object other) {
        // immediately return true if both pointers reference the same object
        if (this == other) {
            return true;
        } else if (other instanceof Dog) {
            Dog dog = (Dog) other;
            return name.equals(dog.name) && age == dog.age;
        }
        return false;
    }

    @Override
    public String toString() {
        // return name + " " + age;
        // return String.format("Dog{name = %s, age = %s}", name, age);
        return String.format("Dog %s (%d)", name, age);
    }

    @Override
    public void live() {
        eat();
        makeSound();
    }

    // final, as we never want child-classes to change this behavior
    public final void makeSound() {
        Out.println("woof");
    }
}
