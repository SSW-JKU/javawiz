class Animal {
    String name;

    public Animal(String name) {
        super();
        this.name = name;
    }
}

class Cat extends Animal {
    public boolean isHungry;

    public Cat(String name, boolean isHungry) {
        super(name);
        this.isHungry = isHungry;
    }

    public Cat(String name) {
        this(name, true);
    }

    public Cat() {
        this("Kitty McCatface");
    }

    public void eat() {
        this.isHungry = false;
    }

    public static void main(String[] args) {
        Cat kitty = new Cat();
        kitty.eat();
    }
}