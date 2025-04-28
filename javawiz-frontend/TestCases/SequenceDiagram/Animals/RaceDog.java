// we can only extend Dog if it is not final
public class RaceDog extends Dog {
  // package-private
  final double speed;

  public RaceDog(String name, int age, double speed) {
    super(name, age);
    this.speed = speed;
  }

  // this cannot happen
  // @Override
  // public void makeSound() {
  //   Out.println("woof!");
  // }
}
