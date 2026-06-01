import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-forms-editor',
  standalone: false,
  templateUrl: './forms-editor.component.html',
  styleUrl: './forms-editor.component.scss',
})
export class FormsEditorComponent {
  moduleName = '';

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit() {

    this.route.params.subscribe(params => {
      this.moduleName = params['module'];
    });

  }
}
