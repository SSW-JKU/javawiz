public abstract class AbstractAnimal implements Animal {
  final String name;
  final int age;

  protected AbstractAnimal(String name, int age) {
    this.name = name;
    this.age = age;
  }

  // concrete implementation
  @Override
  public void eat() {
    // here, toString is called implicitly
    Out.println(this + " is eating");
  }

  // abstract method
  public abstract void live();
}
