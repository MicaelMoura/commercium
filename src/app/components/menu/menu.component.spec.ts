import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { MenuComponent } from './menu.component';
import { AuthService } from '../../services/auth.services';
import { BrandingService } from '../../services/branding.service';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;
  let router: jasmine.SpyObj<Router>;
  let authService: {
    activeTenantId: () => string;
    isSystemAdmin: () => boolean;
    hasRole: () => boolean;
    logout: jasmine.Spy<() => Promise<void>>;
  };

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    authService = {
      activeTenantId: () => 'tenant-test',
      isSystemAdmin: () => false,
      hasRole: () => true,
      logout: jasmine.createSpy('logout').and.resolveTo(),
    };
    await TestBed.configureTestingModule({
      declarations: [MenuComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authService },
        { provide: BrandingService, useValue: { config: () => ({ nome: 'COMMERCIUM', slogan: 'Teste', logo: 'assets/brand.svg' }) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recolhe o menu no desktop e informa a mudança', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1200);
    spyOn(component.collapsedChange, 'emit');

    component.toggleMenu();

    expect(component.collapsed()).toBeTrue();
    expect(component.collapsedChange.emit).toHaveBeenCalledOnceWith(true);
  });

  it('abre o drawer sem recolher o menu no mobile', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(390);

    component.toggleMenu();

    expect(component.mobileOpen()).toBeTrue();
    expect(component.collapsed()).toBeFalse();
  });

  it('encerra a sessão Firebase antes de navegar para o login do tenant', async () => {
    await component.logout();

    expect(authService.logout).toHaveBeenCalledOnceWith();
    expect(router.navigate).toHaveBeenCalledOnceWith(['login', 'tenant-test']);
  });
});
